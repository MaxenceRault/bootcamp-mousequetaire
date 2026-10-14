import "server-only";
import { getDb } from "@/utils/db";
import { getBucket, publicUrl } from "@/utils/storage";

// Bucket Cloud Storage des photos de couverture et des images de profil (public en lecture).
export const PHOTO_BUCKET = "biirb-post-photos";

export type NewPost = {
  author_id: string;
  title: string;
  photo_url: string;
  photo_alt: string;
  short_description: string;
  long_description: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  start_date: string;
  end_date: string;
  archetype_id: number;
};

export type NewTag = {
  country_code: string;
  state_code: string | null;
  city: string | null;
};

export async function findArchetypeIdBySlug(slug: string): Promise<number | null> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>("select id from archetype where slug = $1", [slug]);
  return rows[0]?.id ?? null;
}

// Le slug est généré par la base (trigger post_fill_slug, à partir du titre).
// Renvoie l'id et le slug du post créé, ou null si le slug vient d'être pris par un post créé au même instant.
export async function insertPost(post: NewPost): Promise<{ id: number; slug: string } | null> {
  const db = await getDb();
  const result = await db
    .query<{ id: number; slug: string }>(
      `insert into post (author_id, title, photo_url, photo_alt, short_description, long_description,
         destination_country_code, destination_state_code, destination_city, start_date, end_date, archetype_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id, slug`,
      [
        post.author_id,
        post.title,
        post.photo_url,
        post.photo_alt,
        post.short_description,
        post.long_description,
        post.destination_country_code,
        post.destination_state_code,
        post.destination_city,
        post.start_date,
        post.end_date,
        post.archetype_id,
      ],
    )
    .catch((error: { code?: string; constraint?: string }) => {
      // 23505 = violation d'unicité ; seule celle du slug est attendue (sinon l'erreur remonte).
      if (error.code === "23505" && error.constraint === "post_slug_key") return null;
      throw error;
    });
  return result?.rows[0] ?? null;
}

// Slug d'un post visible à partir de son id (anciens liens /post/30), null s'il n'existe pas ou est masqué.
export async function findPostSlugById(id: number): Promise<string | null> {
  const db = await getDb();
  const { rows } = await db.query<{ slug: string }>("select slug from post where id = $1 and not is_hidden", [id]);
  return rows[0]?.slug ?? null;
}

// Suppression (nettoyage si la création échoue en cours de route) ; post_tag suit en cascade.
export async function deletePost(id: number) {
  const db = await getDb();
  await db.query("delete from post where id = $1", [id]);
}

// Crée les lieux manquants et renvoie les ids de tous les lieux (existants ou nouveaux).
// Le « do update » sans effet sert uniquement à ce que « returning » renvoie aussi les lieux existants.
export async function upsertTags(tags: NewTag[]): Promise<number[]> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `insert into tag (country_code, state_code, city)
     select * from unnest($1::char(2)[], $2::varchar[], $3::varchar[])
     on conflict (country_code, state_code, city) do update set country_code = excluded.country_code
     returning id`,
    [tags.map((tag) => tag.country_code), tags.map((tag) => tag.state_code), tags.map((tag) => tag.city)],
  );
  return rows.map(({ id }) => id);
}

export async function insertPostTags(postId: number, tagIds: number[]) {
  const db = await getDb();
  await db.query("insert into post_tag (post_id, tag_id) select $1, unnest($2::int[])", [postId, tagIds]);
}

// Envoie la photo dans le bucket et renvoie son URL publique.
export async function uploadPostPhoto(path: string, photo: File, contentType: string): Promise<string> {
  await getBucket(PHOTO_BUCKET)
    .file(path)
    .save(Buffer.from(await photo.arrayBuffer()), {
      contentType,
      resumable: false,
      // Échoue si un fichier existe déjà à ce chemin (jamais d'écrasement).
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  return publicUrl(PHOTO_BUCKET, path);
}

export async function deletePostPhoto(path: string) {
  await getBucket(PHOTO_BUCKET).file(path).delete();
}

// Résumé d'un post pour la grille « Récits publiés » du profil.
export type PostSummary = {
  id: number;
  title: string;
  slug: string;
  photo_url: string;
  photo_alt: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  start_date: string;
  created_at: string;
  is_hidden: boolean;
};

const SUMMARY_COLUMNS = [
  "id",
  "title",
  "slug",
  "photo_url",
  "photo_alt",
  "destination_country_code",
  "destination_state_code",
  "destination_city",
  "start_date",
  "created_at",
  "is_hidden",
];

// Colonnes préfixées par l'alias de table (requêtes avec jointure).
const prefixed = (alias: string, columns: string[]) => columns.map((column) => `${alias}.${column}`).join(", ");

// Auteur d'un post, au même format que PublicUser.
const AUTHOR_JSON = `json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
  'avatar_url', u.avatar_url, 'avatar_seed', u.avatar_seed,
  'avatar_background_color', u.avatar_background_color)`;

// Posts d'un auteur, du plus récent au plus ancien, avec le nombre total.
export async function findPostsByAuthor(
  authorId: string,
  limit: number,
): Promise<{ posts: PostSummary[]; total: number }> {
  const db = await getDb();
  const [posts, count] = await Promise.all([
    db.query<PostSummary>(
      `select ${SUMMARY_COLUMNS.join(", ")} from post where author_id = $1 order by created_at desc limit $2`,
      [authorId, limit],
    ),
    db.query<{ total: number }>("select count(*)::int as total from post where author_id = $1", [authorId]),
  ]);

  return { posts: posts.rows, total: count.rows[0].total };
}

// Post complet pour la page détail (null s'il n'existe pas ou s'il est masqué par son auteur).
export type PostDetailRow = {
  id: number;
  title: string;
  slug: string;
  photo_url: string;
  photo_alt: string;
  short_description: string;
  long_description: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  archetype: { slug: string };
  author: { id: string; username: string; display_name: string; avatar_url: string | null; avatar_seed: string | null; avatar_background_color: string | null };
  post_tag: { tag: { country_code: string; state_code: string | null; city: string | null } }[];
};

// Recherche par slug (URL /post/okinawa-et-ile-zamami) ou par id. « column » vient de ce type fermé,
// jamais de l'utilisateur ; la valeur reste passée en paramètre $1.
export async function findPostDetail(key: { slug: string } | { id: number }): Promise<PostDetailRow | null> {
  const [column, value] = "slug" in key ? ["slug", key.slug] : ["id", key.id];
  const db = await getDb();
  const { rows } = await db.query<PostDetailRow>(
    `select p.id, p.title, p.slug, p.photo_url, p.photo_alt, p.short_description, p.long_description,
       p.destination_country_code, p.destination_state_code, p.destination_city, p.start_date, p.end_date, p.created_at,
       json_build_object('slug', a.slug) as archetype,
       ${AUTHOR_JSON} as author,
       coalesce(
         (select json_agg(json_build_object('tag', json_build_object(
                   'country_code', t.country_code, 'state_code', t.state_code, 'city', t.city)))
            from post_tag pt join tag t on t.id = pt.tag_id
           where pt.post_id = p.id),
         '[]'
       ) as post_tag
     from post p
     join archetype a on a.id = p.archetype_id
     join users u on u.id = p.author_id
     where p.${column} = $1 and not p.is_hidden`,
    [value],
  );
  return rows[0] ?? null;
}

export type PlaceFilter = { country: string; state?: string; city?: string };

// Ids des posts visibles (non masqués) liés à un lieu : destination OU tag dans ce lieu.
// Hiérarchique : un pays inclut ses régions et ses villes, une région inclut ses villes.
export async function findPostIdsByPlace({ country, state, city }: PlaceFilter): Promise<number[]> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `select id from post
      where not is_hidden
        and destination_country_code = $1
        and ($2::text is null or destination_state_code = $2)
        and ($3::text is null or destination_city = $3)
     union
     select pt.post_id from post_tag pt
       join tag t on t.id = pt.tag_id
       join post p on p.id = pt.post_id and not p.is_hidden
      where t.country_code = $1
        and ($2::text is null or t.state_code = $2)
        and ($3::text is null or t.city = $3)`,
    [country, state ?? null, city ?? null],
  );
  return rows.map(({ id }) => id);
}

// Résumé d'un post avec son auteur, pour les listes de récits.
export type PostSummaryWithAuthor = PostSummary & {
  author: { id: string; username: string; display_name: string; avatar_url: string | null; avatar_seed: string | null; avatar_background_color: string | null };
};

export async function findPostSummariesByIds(ids: number[], limit: number): Promise<PostSummaryWithAuthor[]> {
  if (ids.length === 0) return [];

  const db = await getDb();
  const { rows } = await db.query<PostSummaryWithAuthor>(
    `select ${prefixed("p", SUMMARY_COLUMNS)}, ${AUTHOR_JSON} as author
     from post p join users u on u.id = p.author_id
     where p.id = any($1::int[]) and not p.is_hidden
     order by p.created_at desc
     limit $2`,
    [ids, limit],
  );
  return rows;
}

// Post transmis à l'IA du planificateur (textes tronqués : taille du prompt maîtrisée).
export type PostForTrip = {
  id: number;
  title: string;
  short_description: string;
  long_description: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  tags: { country_code: string; state_code: string | null; city: string | null }[];
};

// Posts du même type de récit dont la destination OU un tag est dans le lieu choisi (hiérarchique,
// comme findPostIdsByPlace), les plus récents d'abord.
export async function findPostsForTrip(
  { country, state, city }: PlaceFilter,
  archetypeId: number,
  limit: number,
): Promise<PostForTrip[]> {
  const db = await getDb();
  const { rows } = await db.query<PostForTrip>(
    `select p.id, p.title, p.short_description, left(p.long_description, 1500) as long_description,
       p.destination_country_code, p.destination_state_code, p.destination_city,
       coalesce(
         (select json_agg(json_build_object('country_code', t.country_code, 'state_code', t.state_code, 'city', t.city))
            from post_tag pt join tag t on t.id = pt.tag_id
           where pt.post_id = p.id),
         '[]'
       ) as tags
     from post p
     where p.archetype_id = $4
       and not p.is_hidden
       and p.id in (
         select id from post
          where destination_country_code = $1
            and ($2::text is null or destination_state_code = $2)
            and ($3::text is null or destination_city = $3)
         union
         select pt.post_id from post_tag pt join tag t on t.id = pt.tag_id
          where t.country_code = $1
            and ($2::text is null or t.state_code = $2)
            and ($3::text is null or t.city = $3)
       )
     order by p.created_at desc
     limit $5`,
    [country, state ?? null, city ?? null, archetypeId, limit],
  );
  return rows;
}

// Ligne du feed : post + slug du type de récit + profil public de l'auteur (jamais email ni hash).
export type FeedPostRow = {
  id: number;
  title: string;
  slug: string;
  short_description: string;
  photo_url: string;
  photo_alt: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  created_at: string;
  like_count: number;
  archetype: { slug: string };
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    avatar_seed: string | null;
    avatar_background_color: string | null;
  };
};

// Posts visibles du plus récent au plus ancien. Pagination par curseur : beforeId = id du dernier post
// déjà affiché (les ids sont croissants dans le temps). Filtre facultatif sur le slug du type de récit.
// Colonnes et jointures d'une ligne du feed (partagées par le feed et la recherche).
const FEED_SELECT = `select p.id, p.title, p.slug, p.short_description, p.photo_url, p.photo_alt,
       p.destination_country_code, p.destination_state_code, p.destination_city, p.created_at,
       (select count(*)::int from post_like l where l.post_id = p.id) as like_count,
       json_build_object('slug', a.slug) as archetype,
       ${AUTHOR_JSON} as author
     from post p
     join archetype a on a.id = p.archetype_id
     join users u on u.id = p.author_id`;

export async function findFeedPosts({
  archetype,
  beforeId,
  limit,
}: {
  archetype?: string;
  beforeId?: number;
  limit: number;
}): Promise<FeedPostRow[]> {
  const db = await getDb();
  const { rows } = await db.query<FeedPostRow>(
    `${FEED_SELECT}
     where not p.is_hidden
       and ($1::text is null or a.slug = $1)
       and ($2::int is null or p.id < $2)
     order by p.id desc
     limit $3`,
    [archetype ?? null, beforeId ?? null, limit],
  );
  return rows;
}

// Auteur et photo d'un post (vérification du propriétaire avant modification), null s'il n'existe pas.
export async function findPostOwnership(id: number): Promise<{ author_id: string; photo_url: string } | null> {
  const db = await getDb();
  const { rows } = await db.query<{ author_id: string; photo_url: string }>(
    "select author_id, photo_url from post where id = $1",
    [id],
  );
  return rows[0] ?? null;
}

// Le filtre author_id double la vérification du service : un post d'un autre auteur n'est jamais touché.
export async function updatePostVisibility(id: number, authorId: string, hidden: boolean): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("update post set is_hidden = $3 where id = $1 and author_id = $2", [
    id,
    authorId,
    hidden,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function deleteAuthorPost(id: number, authorId: string): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("delete from post where id = $1 and author_id = $2", [id, authorId]);
  return (rowCount ?? 0) > 0;
}

// Chemin d'une photo dans le bucket à partir de son URL publique ; null si elle est hébergée ailleurs
// (ex. photos Unsplash des données de démo).
export function photoPathFromUrl(url: string): string | null {
  const prefix = publicUrl(PHOTO_BUCKET, "");
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

// Posts enregistrés par un utilisateur (visibles uniquement), du dernier enregistré au premier.
export async function findSavedPostsByUser(userId: string, limit: number): Promise<PostSummaryWithAuthor[]> {
  const db = await getDb();
  const { rows } = await db.query<PostSummaryWithAuthor>(
    `select ${prefixed("p", SUMMARY_COLUMNS)}, ${AUTHOR_JSON} as author
     from post_save s
     join post p on p.id = s.post_id and not p.is_hidden
     join users u on u.id = p.author_id
     where s.user_id = $1
     order by s.created_at desc
     limit $2`,
    [userId, limit],
  );
  return rows;
}

// Échappe les caractères spéciaux de LIKE (le texte reste ensuite passé en paramètre $1).
function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type SearchPlace = { country: string; state: string | null; city: string | null };

// Recherche dans les posts visibles, classés par pertinence :
//   1. un tag ou la destination est dans un des lieux trouvés (hiérarchique : un pays inclut ses villes) ;
//   2. sinon le titre contient le texte ;
//   3. sinon la description courte ou longue contient le texte.
// À rang égal, du plus récent au plus ancien.
export async function searchFeedPosts({
  text,
  places,
  limit,
}: {
  text: string;
  places: SearchPlace[];
  limit: number;
}): Promise<FeedPostRow[]> {
  const db = await getDb();
  const { rows } = await db.query<FeedPostRow>(
    `with wanted as (
       select * from jsonb_to_recordset($2::jsonb) as w(country text, state text, city text)
     ),
     ranked as (
       select p.id,
         case
           when exists (
             select 1 from wanted w
              where (p.destination_country_code = w.country
                     and (w.state is null or p.destination_state_code = w.state)
                     and (w.city is null or p.destination_city = w.city))
                 or exists (select 1 from post_tag pt join tag t on t.id = pt.tag_id
                             where pt.post_id = p.id and t.country_code = w.country
                               and (w.state is null or t.state_code = w.state)
                               and (w.city is null or t.city = w.city))
           ) then 1
           when p.title ilike $1 escape '\\' then 2
           when p.short_description ilike $1 escape '\\' or p.long_description ilike $1 escape '\\' then 3
         end as rank
       from post p
       where not p.is_hidden
     )
     ${FEED_SELECT}
     join ranked r on r.id = p.id
     where r.rank is not null
     order by r.rank, p.id desc
     limit $3`,
    [`%${escapeLike(text)}%`, JSON.stringify(places), limit],
  );
  return rows;
}

import "server-only";
import { getDb } from "@/utils/db";
import { getBucket, publicUrl } from "@/utils/storage";

// Bucket Cloud Storage des photos de couverture (public en lecture).
const PHOTO_BUCKET = "biirb-post-photos";

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

export async function insertPost(post: NewPost): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `insert into post (author_id, title, photo_url, photo_alt, short_description, long_description,
       destination_country_code, destination_state_code, destination_city, start_date, end_date, archetype_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning id`,
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
  );
  return rows[0].id;
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
  photo_url: string;
  photo_alt: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  start_date: string;
  created_at: string;
};

const SUMMARY_COLUMNS = [
  "id",
  "title",
  "photo_url",
  "photo_alt",
  "destination_country_code",
  "destination_state_code",
  "destination_city",
  "start_date",
  "created_at",
];

// Colonnes préfixées par l'alias de table (requêtes avec jointure).
const prefixed = (alias: string, columns: string[]) => columns.map((column) => `${alias}.${column}`).join(", ");

// Auteur d'un post, au même format que PublicUser.
const AUTHOR_JSON = `json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name,
  'avatar_url', u.avatar_url, 'avatar_seed', u.avatar_seed)`;

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

// Post complet pour la page détail.
export type PostDetailRow = {
  id: number;
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
  created_at: string;
  archetype: { slug: string };
  author: { id: string; username: string; display_name: string; avatar_url: string | null; avatar_seed: string | null };
  post_tag: { tag: { country_code: string; state_code: string | null; city: string | null } }[];
};

export async function findPostById(id: number): Promise<PostDetailRow | null> {
  const db = await getDb();
  const { rows } = await db.query<PostDetailRow>(
    `select p.id, p.title, p.photo_url, p.photo_alt, p.short_description, p.long_description,
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
     where p.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export type PlaceFilter = { country: string; state?: string; city?: string };

// Ids des posts liés à un lieu : destination OU tag dans ce lieu.
// Hiérarchique : un pays inclut ses régions et ses villes, une région inclut ses villes.
export async function findPostIdsByPlace({ country, state, city }: PlaceFilter): Promise<number[]> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `select id from post
      where destination_country_code = $1
        and ($2::text is null or destination_state_code = $2)
        and ($3::text is null or destination_city = $3)
     union
     select pt.post_id from post_tag pt join tag t on t.id = pt.tag_id
      where t.country_code = $1
        and ($2::text is null or t.state_code = $2)
        and ($3::text is null or t.city = $3)`,
    [country, state ?? null, city ?? null],
  );
  return rows.map(({ id }) => id);
}

// Résumé d'un post avec son auteur, pour les listes de récits.
export type PostSummaryWithAuthor = PostSummary & {
  author: { id: string; username: string; display_name: string; avatar_url: string | null; avatar_seed: string | null };
};

export async function findPostSummariesByIds(ids: number[], limit: number): Promise<PostSummaryWithAuthor[]> {
  if (ids.length === 0) return [];

  const db = await getDb();
  const { rows } = await db.query<PostSummaryWithAuthor>(
    `select ${prefixed("p", SUMMARY_COLUMNS)}, ${AUTHOR_JSON} as author
     from post p join users u on u.id = p.author_id
     where p.id = any($1::int[])
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

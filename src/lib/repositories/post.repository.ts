import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

const PHOTO_BUCKET = "post-photos";

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
  const { data, error } = await createAdminClient()
    .from("archetype")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function insertPost(post: NewPost): Promise<number> {
  const { data, error } = await createAdminClient().from("post").insert(post).select("id").single();

  if (error) throw error;
  return data.id;
}

// Suppression (nettoyage si la création échoue en cours de route) ; post_tag suit en cascade.
export async function deletePost(id: number) {
  const { error } = await createAdminClient().from("post").delete().eq("id", id);
  if (error) throw error;
}

// Crée les lieux manquants et renvoie les ids de tous les lieux (existants ou nouveaux).
export async function upsertTags(tags: NewTag[]): Promise<number[]> {
  const { data, error } = await createAdminClient()
    .from("tag")
    .upsert(tags, { onConflict: "country_code,state_code,city" })
    .select("id");

  if (error) throw error;
  return data.map(({ id }) => id);
}

export async function insertPostTags(postId: number, tagIds: number[]) {
  const { error } = await createAdminClient()
    .from("post_tag")
    .insert(tagIds.map((tagId) => ({ post_id: postId, tag_id: tagId })));

  if (error) throw error;
}

// Envoie la photo dans le bucket et renvoie son URL publique.
export async function uploadPostPhoto(path: string, photo: File, contentType: string): Promise<string> {
  const storage = createAdminClient().storage.from(PHOTO_BUCKET);
  const { error } = await storage.upload(path, photo, { contentType, upsert: false });

  if (error) throw error;
  return storage.getPublicUrl(path).data.publicUrl;
}

export async function deletePostPhoto(path: string) {
  const { error } = await createAdminClient().storage.from(PHOTO_BUCKET).remove([path]);
  if (error) throw error;
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

const SUMMARY_COLUMNS =
  "id, title, photo_url, photo_alt, destination_country_code, destination_state_code, destination_city, start_date, created_at";

// Posts d'un auteur, du plus récent au plus ancien, avec le nombre total.
export async function findPostsByAuthor(
  authorId: string,
  limit: number,
): Promise<{ posts: PostSummary[]; total: number }> {
  const { data, error, count } = await createAdminClient()
    .from("post")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return { posts: (data ?? []) as PostSummary[], total: count ?? 0 };
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

const DETAIL_COLUMNS = `id, title, photo_url, photo_alt, short_description, long_description,
  destination_country_code, destination_state_code, destination_city, start_date, end_date, created_at,
  archetype:archetype!inner(slug),
  author:users!inner(id, username, display_name, avatar_url, avatar_seed),
  post_tag(tag(country_code, state_code, city))`;

export async function findPostById(id: number): Promise<PostDetailRow | null> {
  const { data, error } = await createAdminClient()
    .from("post")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as PostDetailRow | null;
}

export type PlaceFilter = { country: string; state?: string; city?: string };

// Ids des posts liés à un lieu : destination OU tag dans ce lieu.
// Hiérarchique : un pays inclut ses régions et ses villes, une région inclut ses villes.
export async function findPostIdsByPlace({ country, state, city }: PlaceFilter): Promise<number[]> {
  const client = createAdminClient();

  let byDestination = client.from("post").select("id").eq("destination_country_code", country);
  if (state) byDestination = byDestination.eq("destination_state_code", state);
  if (city) byDestination = byDestination.eq("destination_city", city);

  let byTag = client.from("post_tag").select("post_id, tag!inner(country_code)").eq("tag.country_code", country);
  if (state) byTag = byTag.eq("tag.state_code", state);
  if (city) byTag = byTag.eq("tag.city", city);

  const [destinations, tags] = await Promise.all([byDestination, byTag]);
  if (destinations.error) throw destinations.error;
  if (tags.error) throw tags.error;

  return [...new Set([...destinations.data.map(({ id }) => id), ...tags.data.map(({ post_id }) => post_id)])];
}

// Résumé d'un post avec son auteur, pour les listes de récits.
export type PostSummaryWithAuthor = PostSummary & {
  author: { id: string; username: string; display_name: string; avatar_url: string | null; avatar_seed: string | null };
};

export async function findPostSummariesByIds(ids: number[], limit: number): Promise<PostSummaryWithAuthor[]> {
  if (ids.length === 0) return [];

  const { data, error } = await createAdminClient()
    .from("post")
    .select(`${SUMMARY_COLUMNS}, author:users!inner(id, username, display_name, avatar_url, avatar_seed)`)
    .in("id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as PostSummaryWithAuthor[];
}

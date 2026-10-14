import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

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

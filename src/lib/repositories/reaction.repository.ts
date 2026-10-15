import "server-only";
import { getDb } from "@/utils/db";

export type ReactionKind = "like" | "save";

// Nom de table issu de cette liste fixe, jamais d'une entrée.
const TABLES: Record<ReactionKind, string> = { like: "post_like", save: "post_save" };

// Post supprimé entre la vérification et l'insertion.
const FOREIGN_KEY_VIOLATION = "23503";

export class ReactionTargetMissingError extends Error {
  constructor() {
    super("reaction_target_missing");
  }
}

export async function isPostVisible(postId: number): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("select 1 from post where id = $1 and not is_hidden", [postId]);
  return rowCount === 1;
}

export async function addReaction(kind: ReactionKind, userId: string, postId: number) {
  const db = await getDb();
  try {
    await db.query(`insert into ${TABLES[kind]} (user_id, post_id) values ($1, $2) on conflict do nothing`, [
      userId,
      postId,
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === FOREIGN_KEY_VIOLATION) throw new ReactionTargetMissingError();
    throw error;
  }
}

export async function removeReaction(kind: ReactionKind, userId: string, postId: number) {
  const db = await getDb();
  await db.query(`delete from ${TABLES[kind]} where user_id = $1 and post_id = $2`, [userId, postId]);
}

export async function countLikes(postId: number): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ total: number }>("select count(*)::int as total from post_like where post_id = $1", [
    postId,
  ]);
  return rows[0].total;
}

export type ReactionState = { like_count: number; liked: boolean; saved: boolean };

export async function findReactionState(userId: string, postId: number): Promise<ReactionState> {
  const db = await getDb();
  const { rows } = await db.query<ReactionState>(
    `select (select count(*)::int from post_like where post_id = $2) as like_count,
            exists (select 1 from post_like where user_id = $1 and post_id = $2) as liked,
            exists (select 1 from post_save where user_id = $1 and post_id = $2) as saved`,
    [userId, postId],
  );
  return rows[0];
}

export type ViewerReaction = { post_id: number; like_count: number; liked: boolean; saved: boolean };

export async function findViewerReactions(userId: string, postIds: number[]): Promise<ViewerReaction[]> {
  const db = await getDb();
  const { rows } = await db.query<ViewerReaction>(
    `select p.id as post_id,
            (select count(*)::int from post_like where post_id = p.id) as like_count,
            exists (select 1 from post_like where user_id = $1 and post_id = p.id) as liked,
            exists (select 1 from post_save where user_id = $1 and post_id = p.id) as saved
     from unnest($2::int[]) as p(id)`,
    [userId, postIds],
  );
  return rows;
}

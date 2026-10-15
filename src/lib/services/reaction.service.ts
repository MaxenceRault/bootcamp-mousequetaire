import "server-only";
import {
  addReaction,
  countLikes,
  findReactionState,
  findViewerReactions,
  isPostVisible,
  ReactionTargetMissingError,
  removeReaction,
  type ReactionKind,
} from "@/lib/repositories/reaction.repository";

export type { ReactionKind };

export class ReactionError extends Error {
  constructor(public readonly code: "NOT_FOUND") {
    super(code);
  }
}

export type Reactions = { likeCount: number; liked: boolean; saved: boolean };

// Un post masqué ou supprimé est introuvable ; retirer une réaction reste possible.
export async function setReaction(kind: ReactionKind, userId: string, postId: number, active: boolean): Promise<Reactions> {
  if (active) {
    if (!(await isPostVisible(postId))) throw new ReactionError("NOT_FOUND");
    try {
      await addReaction(kind, userId, postId);
    } catch (error) {
      if (error instanceof ReactionTargetMissingError) throw new ReactionError("NOT_FOUND");
      throw error;
    }
  } else {
    await removeReaction(kind, userId, postId);
  }
  return toReactions(await findReactionState(userId, postId));
}

export async function getReactions(userId: string, postId: number): Promise<Reactions> {
  if (!(await isPostVisible(postId))) throw new ReactionError("NOT_FOUND");
  return toReactions(await findReactionState(userId, postId));
}

function toReactions({ like_count, liked, saved }: { like_count: number; liked: boolean; saved: boolean }): Reactions {
  return { likeCount: like_count, liked, saved };
}

export function getLikeCount(postId: number): Promise<number> {
  return countLikes(postId);
}

export type ViewerReactions = { postId: number; likeCount: number; liked: boolean; saved: boolean }[];

export async function getViewerReactions(userId: string, postIds: number[]): Promise<ViewerReactions> {
  const rows = await findViewerReactions(userId, postIds);
  return rows.map(({ post_id, like_count, liked, saved }) => ({ postId: post_id, likeCount: like_count, liked, saved }));
}

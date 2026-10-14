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

export class ReactionError extends Error {
  constructor(public readonly code: "NOT_FOUND") {
    super(code);
  }
}

export type Reactions = { likeCount: number; liked: boolean; saved: boolean };

// Like / enregistrement d'un post visible (un post masqué ou supprimé est introuvable).
// Retirer une réaction reste possible même si le post a été masqué entre-temps.
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

// État des réactions de l'utilisateur sur un post visible.
export async function getReactions(userId: string, postId: number): Promise<Reactions> {
  if (!(await isPostVisible(postId))) throw new ReactionError("NOT_FOUND");
  return toReactions(await findReactionState(userId, postId));
}

function toReactions({ like_count, liked, saved }: { like_count: number; liked: boolean; saved: boolean }): Reactions {
  return { likeCount: like_count, liked, saved };
}

// Nombre de likes affiché à tous (page détail, rendue côté serveur).
export function getLikeCount(postId: number): Promise<number> {
  return countLikes(postId);
}

export type ViewerReactions = { postId: number; likeCount: number; liked: boolean; saved: boolean }[];

// Mes réactions sur plusieurs posts à la fois (feed). Un id inconnu renvoie simplement false / false.
export async function getViewerReactions(userId: string, postIds: number[]): Promise<ViewerReactions> {
  const rows = await findViewerReactions(userId, postIds);
  return rows.map(({ post_id, like_count, liked, saved }) => ({ postId: post_id, likeCount: like_count, liked, saved }));
}

import "server-only";
import { insertAdminAction } from "@/lib/repositories/admin.repository";
import {
  deleteComment as deleteCommentRow,
  findCommentAuthor,
  findCommentsByPost,
  insertComment,
} from "@/lib/repositories/comment.repository";
import { findPostSlugById } from "@/lib/repositories/post.repository";
import { findUserAccess } from "@/lib/repositories/user.repository";
import { moderateComment, type ModerationReason } from "@/lib/services/moderation.service";

export class CommentError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONTENT_REJECTED",
    public readonly reasons: ModerationReason[] = [],
  ) {
    super(code);
  }
}

const COMMENTS_LIMIT = 200;

// Commentaires d'un récit visible (un récit masqué n'en a pas en public).
export async function listComments(postId: number) {
  if (!(await findPostSlugById(postId))) throw new CommentError("NOT_FOUND");
  return findCommentsByPost(postId, COMMENTS_LIMIT);
}

export async function addComment(userId: string, postId: number, content: string) {
  const [access, slug] = await Promise.all([findUserAccess(userId), findPostSlugById(postId)]);
  if (!access || access.banned_at) throw new CommentError("FORBIDDEN");
  if (!slug) throw new CommentError("NOT_FOUND");

  // IA indisponible : un commentaire court est publié quand même (l'admin peut le supprimer).
  const moderation = await moderateComment(content);
  if (moderation.status === "rejected") throw new CommentError("CONTENT_REJECTED", moderation.reasons);

  return insertComment(postId, userId, content);
}

// Par son auteur ou par un admin (action tracée dans le journal).
export async function removeComment(userId: string, postId: number, commentId: number) {
  const [authorId, access] = await Promise.all([findCommentAuthor(postId, commentId), findUserAccess(userId)]);
  if (!authorId) throw new CommentError("NOT_FOUND");
  const isAdmin = access?.role === "admin" && !access.banned_at;
  if (authorId !== userId && !isAdmin) throw new CommentError("NOT_FOUND");

  await deleteCommentRow(commentId);
  if (authorId !== userId) {
    await insertAdminAction({ admin_id: userId, action: "comment.delete", target_type: "post", target_id: String(postId), details: { commentId } });
  }
}

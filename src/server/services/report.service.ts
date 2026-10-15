import "server-only";
import { findPostOwnership } from "@/server/repositories/post.repository";
import { insertReport } from "@/server/repositories/report.repository";
import { findUserAccess } from "@/server/repositories/user.repository";

export class ReportError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN" | "OWN_POST") {
    super(code);
  }
}

// Signaler deux fois le même post n'a pas d'effet de plus.
export async function reportPost(userId: string, postId: number, reason: string | null) {
  const [access, post] = await Promise.all([findUserAccess(userId), findPostOwnership(postId)]);
  if (!access || access.banned_at) throw new ReportError("FORBIDDEN");
  if (!post) throw new ReportError("NOT_FOUND");
  if (post.author_id === userId) throw new ReportError("OWN_POST");

  await insertReport(postId, userId, reason);
}

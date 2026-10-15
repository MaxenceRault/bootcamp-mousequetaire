import "server-only";
import { connection } from "next/server";
import { getConfig } from "@/server/config";
import { getUserIdFromRequest } from "@/server/jwt";
import { isRateLimited } from "@/server/rateLimit";
import { addComment, CommentError, listComments, removeComment } from "@/server/services/comment.service";
import { createCommentSchema } from "@/schemas/comment.schema";
import { postIdSchema } from "@/schemas/post.schema";
import { logError, logInfo } from "@/server/logger";

type Context = { params: Promise<Record<string, string | string[] | undefined>> };

// GET /api/v1/posts/{id}/comments (public)
export async function listCommentsController(_request: Request, { params }: Context) {
  await connection();
  const postId = postIdSchema.safeParse((await params).id);
  if (!postId.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json({ comments: await listComments(postId.data) });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/v1/posts/{id}/comments
export async function createCommentController(request: Request, { params }: Context) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const { max, windowMs } = getConfig().rateLimits.comment;
  if (isRateLimited(`comments:${userId}`, max, windowMs)) return errorResponse(429, "TOO_MANY_REQUESTS");

  const postId = postIdSchema.safeParse((await params).id);
  const body = createCommentSchema.safeParse(await request.json().catch(() => null));
  if (!postId.success || !body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json({ comment: await addComment(userId, postId.data, body.data.content, body.data.parentId) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE /api/v1/posts/{id}/comments/{commentId}
export async function deleteCommentController(request: Request, { params }: Context) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const routeParams = await params;
  const postId = postIdSchema.safeParse(routeParams.id);
  const commentId = postIdSchema.safeParse(routeParams.commentId);
  if (!postId.success || !commentId.success) return errorResponse(400, "INVALID_INPUT");

  try {
    await removeComment(userId, postId.data, commentId.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof CommentError) {
    if (error.code === "CONTENT_REJECTED") {
      // Motif dans les logs seulement : l'auteur ne doit pas pouvoir deviner la liste des mots bannis.
      logInfo("moderation", { rejected: error.reasons });
      return errorResponse(422, error.code);
    }
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "INVALID_PARENT" ? 400 : 404;
    return errorResponse(status, error.code);
  }
  logError("comments", error);
  return errorResponse(500, "INTERNAL_ERROR");
}

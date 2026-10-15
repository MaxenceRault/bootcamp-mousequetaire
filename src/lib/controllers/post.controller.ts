import "server-only";
import { connection } from "next/server";
import { getConfig } from "@/lib/config";
import { getUserIdFromRequest } from "@/lib/jwt";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import {
  createPostSchema,
  feedQuerySchema,
  BODY_PHOTO_MAX,
  BODY_PHOTO_MAX_BYTES,
  PHOTO_MAX_BYTES,
  postIdSchema,
  updatePostSchema,
} from "@/schemas/post.schema";
import { createPost, deleteOwnPost, getFeedPage, PostError, setPostHidden } from "@/lib/services/post.service";
import { logError, logInfo } from "@/lib/logger";

// Doit rester sous proxyClientMaxBodySize (next.config.ts) : le proxy tronque au-delà.
const MAX_BODY_BYTES = PHOTO_MAX_BYTES + BODY_PHOTO_MAX * BODY_PHOTO_MAX_BYTES + 1024 * 1024;

// GET /api/v1/posts?archetype=&cursor=&limit= (public)
export async function getFeedController(request: Request) {
  // Jamais pré-calculé au build (cacheComponents).
  await connection();
  const { max, windowMs } = getConfig().rateLimits.feed;
  if (isRateLimited(`posts:feed:${clientIp(request)}`, max, windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const query = feedQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json(await getFeedPage(query.data));
  } catch (error) {
    return internalError(error);
  }
}

// POST /api/v1/posts (multipart)
export async function createPostController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const { max, windowMs } = getConfig().rateLimits.postCreate;
  if (isRateLimited(`posts:create:${userId}`, max, windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (!contentLength) return errorResponse(411, "LENGTH_REQUIRED");
  if (contentLength > MAX_BODY_BYTES) return errorResponse(413, "PAYLOAD_TOO_LARGE");

  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse(400, "INVALID_INPUT");

  const body = createPostSchema.safeParse(formToObject(form));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json(await createPost(userId, body.data), { status: 201 });
  } catch (error) {
    if (error instanceof PostError && error.code === "CONTENT_REJECTED") {
      // Motif dans les logs seulement : l'auteur ne doit pas pouvoir deviner la liste des mots bannis.
      logInfo("moderation", { rejected: error.reasons });
      return errorResponse(422, error.code);
    }
    if (error instanceof PostError) return errorResponse(400, error.code);
    return internalError(error);
  }
}

// PATCH /api/v1/posts/{id} { hidden }
export async function updatePostController(request: Request, { params }: RouteContext<"/api/v1/posts/[id]">) {
  const guard = await authorizePostEdit(request, (await params).id);
  if ("response" in guard) return guard.response;

  const body = updatePostSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json(await setPostHidden(guard.userId, guard.postId, body.data.hidden));
  } catch (error) {
    return postEditError(error);
  }
}

// DELETE /api/v1/posts/{id}
export async function deletePostController(request: Request, { params }: RouteContext<"/api/v1/posts/[id]">) {
  const guard = await authorizePostEdit(request, (await params).id);
  if ("response" in guard) return guard.response;

  try {
    await deleteOwnPost(guard.userId, guard.postId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return postEditError(error);
  }
}

// L'auteur du post est vérifié par le service.
async function authorizePostEdit(
  request: Request,
  rawId: string,
): Promise<{ userId: string; postId: number } | { response: Response }> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { response: errorResponse(401, "UNAUTHORIZED") };

  const { max, windowMs } = getConfig().rateLimits.postEdit;
  if (isRateLimited(`posts:edit:${userId}`, max, windowMs)) {
    return { response: errorResponse(429, "TOO_MANY_REQUESTS") };
  }

  const postId = postIdSchema.safeParse(rawId);
  if (!postId.success) return { response: errorResponse(400, "INVALID_INPUT") };
  return { userId, postId: postId.data };
}

function postEditError(error: unknown) {
  if (error instanceof PostError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "PENDING_REVIEW" ? 403 : 400;
    return errorResponse(status, error.code);
  }
  return internalError(error);
}

function formToObject(form: FormData) {
  const data: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key);
    data[key] = key === "tags" || key === "bodyPhotos" || values.length > 1 ? values : values[0];
  }
  return data;
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function internalError(error: unknown) {
  logError("posts", error);
  return errorResponse(500, "INTERNAL_ERROR");
}

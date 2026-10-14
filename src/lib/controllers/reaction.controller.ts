import "server-only";
import { getConfig } from "@/lib/config";
import { getUserIdFromRequest } from "@/lib/jwt";
import { isRateLimited } from "@/lib/rateLimit";
import type { ReactionKind } from "@/lib/repositories/reaction.repository";
import { getReactions, getViewerReactions, ReactionError, setReaction } from "@/lib/services/reaction.service";
import { postIdSchema, viewerReactionsQuerySchema } from "@/schemas/post.schema";

type PostRouteContext = { params: Promise<{ id: string }> };

// PUT (ajouter) / DELETE (retirer) /api/v1/posts/{id}/like|save (Bearer) → 200 { likeCount, liked, saved }.
// Idempotent : liker deux fois ou retirer un like absent ne change rien.
export function reactionController(kind: ReactionKind, active: boolean) {
  return async (request: Request, { params }: PostRouteContext) => {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return errorResponse(401, "UNAUTHORIZED");

    const { max, windowMs } = getConfig().rateLimits.postReact;
    if (isRateLimited(`posts:react:${userId}`, max, windowMs)) return errorResponse(429, "TOO_MANY_REQUESTS");

    const postId = postIdSchema.safeParse((await params).id);
    if (!postId.success) return errorResponse(400, "INVALID_INPUT");

    try {
      return Response.json(await setReaction(kind, userId, postId.data, active));
    } catch (error) {
      return handleError(error);
    }
  };
}

// GET /api/v1/posts/{id}/reactions (Bearer) → 200 { likeCount, liked, saved } : état de l'utilisateur connecté.
export async function getReactionsController(request: Request, { params }: PostRouteContext) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const postId = postIdSchema.safeParse((await params).id);
  if (!postId.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json(await getReactions(userId, postId.data));
  } catch (error) {
    return handleError(error);
  }
}

// GET /api/v1/users/me/reactions?postIds=1,2,3 (Bearer) → 200 { reactions: [{ postId, liked, saved }] }.
// Un seul appel pour toute une page du feed.
export async function getViewerReactionsController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const { max, windowMs } = getConfig().rateLimits.feed;
  if (isRateLimited(`posts:reactions:${userId}`, max, windowMs)) return errorResponse(429, "TOO_MANY_REQUESTS");

  const query = viewerReactionsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json({ reactions: await getViewerReactions(userId, query.data.postIds) });
  } catch (error) {
    return handleError(error);
  }
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

// Détail dans les logs serveur uniquement ; le client reçoit un code générique.
function handleError(error: unknown) {
  if (error instanceof ReactionError) return errorResponse(404, "NOT_FOUND");

  console.error(
    JSON.stringify({
      level: "error",
      scope: "reactions",
      message: String((error as { message?: unknown })?.message ?? "unknown error"),
    }),
  );
  return errorResponse(500, "INTERNAL_ERROR");
}

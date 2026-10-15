import "server-only";
import { getConfig } from "@/server/config";
import { getUserIdFromRequest } from "@/server/jwt";
import { isRateLimited } from "@/server/rateLimit";
import { ReportError, reportPost } from "@/server/services/report.service";
import { postIdSchema, reportPostSchema } from "@/schemas/post.schema";
import { logError } from "@/server/logger";

// POST /api/v1/posts/{id}/report
export async function reportPostController(request: Request, { params }: RouteContext<"/api/v1/posts/[id]/report">) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const { max, windowMs } = getConfig().rateLimits.report;
  if (isRateLimited(`posts:report:${userId}`, max, windowMs)) return errorResponse(429, "TOO_MANY_REQUESTS");

  const postId = postIdSchema.safeParse((await params).id);
  const body = reportPostSchema.safeParse(await request.json().catch(() => null));
  if (!postId.success || !body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    await reportPost(userId, postId.data, body.data.reason ?? null);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ReportError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
      return errorResponse(status, error.code);
    }
    logError("reports", error);
    return errorResponse(500, "INTERNAL_ERROR");
  }
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

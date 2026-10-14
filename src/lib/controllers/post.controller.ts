import "server-only";
import { getConfig } from "@/lib/config";
import { getUserIdFromRequest } from "@/lib/jwt";
import { isRateLimited } from "@/lib/rateLimit";
import { createPostSchema, PHOTO_MAX_BYTES } from "@/schemas/post.schema";
import { createPost, PostError } from "@/lib/services/post.service";

const MAX_BODY_BYTES = PHOTO_MAX_BYTES + 1024 * 1024;

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
    if (error instanceof PostError) return errorResponse(400, error.code);

    console.error(
      JSON.stringify({
        level: "error",
        scope: "posts",
        message: String((error as { message?: unknown })?.message ?? "unknown error"),
      }),
    );
    return errorResponse(500, "INTERNAL_ERROR");
  }
}


function formToObject(form: FormData) {
  const data: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key);
    data[key] = key === "tags" || values.length > 1 ? values : values[0];
  }
  return data;
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

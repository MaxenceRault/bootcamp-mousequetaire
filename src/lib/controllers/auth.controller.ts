import "server-only";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { AuthError, login, register } from "@/lib/services/auth.service";
import { loginSchema, registerSchema } from "@/schemas/auth.schema";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export async function loginController(request: Request) {
  if (isRateLimited(`login:${clientIp(request)}`, 5, FIFTEEN_MINUTES)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const body = loginSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    // remember ne change pas la durée du token (1h) : il choisit seulement le stockage côté client.
    const result = await login(body.data.email, body.data.password);
    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function registerController(request: Request) {
  if (isRateLimited(`register:${clientIp(request)}`, 5, FIFTEEN_MINUTES)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const body = registerSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    const result = await register(body.data.name, body.data.email, body.data.password);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

function readJson(request: Request) {
  return request.json().catch(() => null);
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof AuthError) {
    return errorResponse(error.code === "EMAIL_TAKEN" ? 409 : 401, error.code);
  }

  console.error(
    JSON.stringify({
      level: "error",
      scope: "auth",
      message: String((error as { message?: unknown })?.message ?? "unknown error"),
    }),
  );
  return errorResponse(500, "INTERNAL_ERROR");
}

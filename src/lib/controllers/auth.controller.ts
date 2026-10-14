import "server-only";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { AuthError, login, logout, refreshSession, register } from "@/lib/services/auth.service";
import { loginSchema, refreshTokenSchema, registerSchema } from "@/schemas/auth.schema";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export async function loginController(request: Request) {
  if (isRateLimited(`login:${clientIp(request)}`, 5, FIFTEEN_MINUTES)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const body = loginSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    // remember fixe la durée du refresh token (30 jours ou 24 h) ; l'access token dure toujours 1 h.
    const result = await login(body.data.email, body.data.password, body.data.remember);
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

export async function refreshController(request: Request) {
  if (isRateLimited(`refresh:${clientIp(request)}`, 30, FIFTEEN_MINUTES)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const body = refreshTokenSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json(await refreshSession(body.data.refreshToken));
  } catch (error) {
    return handleError(error);
  }
}

export async function logoutController(request: Request) {
  const body = refreshTokenSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    await logout(body.data.refreshToken);
    return new Response(null, { status: 204 });
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

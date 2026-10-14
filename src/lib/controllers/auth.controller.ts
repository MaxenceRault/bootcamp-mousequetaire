import "server-only";
import { getConfig } from "@/lib/config";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { AuthError, login, logout, refreshSession, register } from "@/lib/services/auth.service";
import { loginSchema, refreshTokenSchema, registerSchema } from "@/schemas/auth.schema";

export async function loginController(request: Request) {
  const { max, windowMs } = getConfig().rateLimits.login;
  if (isRateLimited(`login:${clientIp(request)}`, max, windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const body = loginSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    // remember fixe la durée du refresh token (REFRESH_TOKEN_REMEMBER_DAYS ou REFRESH_TOKEN_SESSION_HOURS).
    const result = await login(body.data.email, body.data.password, body.data.remember);
    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function registerController(request: Request) {
  const { max, windowMs } = getConfig().rateLimits.register;
  if (isRateLimited(`register:${clientIp(request)}`, max, windowMs)) {
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
  const { max, windowMs } = getConfig().rateLimits.refresh;
  if (isRateLimited(`refresh:${clientIp(request)}`, max, windowMs)) {
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

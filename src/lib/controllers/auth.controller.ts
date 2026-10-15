import "server-only";
import { getConfig } from "@/lib/config";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { AuthError, login, logout, refreshSession, register } from "@/lib/services/auth.service";
import { loginSchema, refreshTokenSchema, registerSchema } from "@/schemas/auth.schema";

const MAX_BODY_BYTES = 4 * 1024;

export async function loginController(request: Request) {
  const { max, windowMs } = getConfig().rateLimits.login;
  if (isRateLimited(`login:${clientIp(request)}`, max, windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const sizeError = checkBodySize(request);
  if (sizeError) return sizeError;

  const body = loginSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  // Même réponse que la limite par IP : ne révèle pas si le compte existe.
  const emailLimit = getConfig().rateLimits.loginEmail;
  if (isRateLimited(`login:email:${body.data.email}`, emailLimit.max, emailLimit.windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  try {
    const result = await login(body.data.email, body.data.password, body.data.remember);
    return tokenResponse(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function registerController(request: Request) {
  const { max, windowMs } = getConfig().rateLimits.register;
  if (isRateLimited(`register:${clientIp(request)}`, max, windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const sizeError = checkBodySize(request);
  if (sizeError) return sizeError;

  const body = registerSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    const result = await register(body.data.name, body.data.email, body.data.password);
    return tokenResponse(result, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function refreshController(request: Request) {
  const { max, windowMs } = getConfig().rateLimits.refresh;
  if (isRateLimited(`refresh:${clientIp(request)}`, max, windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const sizeError = checkBodySize(request);
  if (sizeError) return sizeError;

  const body = refreshTokenSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return tokenResponse(await refreshSession(body.data.refreshToken));
  } catch (error) {
    return handleError(error);
  }
}

export async function logoutController(request: Request) {
  const sizeError = checkBodySize(request);
  if (sizeError) return sizeError;

  const body = refreshTokenSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    await logout(body.data.refreshToken);
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleError(error);
  }
}

// Refusé avant lecture (il serait chargé entièrement en mémoire).
function checkBodySize(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (!length) return errorResponse(411, "LENGTH_REQUIRED");
  if (length > MAX_BODY_BYTES) return errorResponse(413, "PAYLOAD_TOO_LARGE");
  return null;
}

function readJson(request: Request) {
  return request.json().catch(() => null);
}

// Contient des tokens : jamais mis en cache.
function tokenResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof AuthError) {
    const status = error.code === "EMAIL_TAKEN" ? 409 : error.code === "ACCOUNT_BANNED" ? 403 : 401;
    return errorResponse(status, error.code);
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

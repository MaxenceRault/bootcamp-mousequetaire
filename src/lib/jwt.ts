import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getConfig } from "@/lib/config";

// Deux clés distinctes : un access token ne peut pas servir de refresh token.
function getSecret() {
  return new TextEncoder().encode(getConfig().jwtSecret);
}

function getRefreshSecret() {
  return new TextEncoder().encode(getConfig().jwtRefreshSecret);
}

export function signToken(userId: string, expiresIn = getConfig().jwtExpiresIn) {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  return payload.sub ?? null;
}

// Aussi enregistré en base (empreinte) pour être révocable : voir auth.service.
export function signRefreshToken(userId: string, expiresAt: Date) {
  return new SignJWT({ token_use: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getRefreshSecret());
}

export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret(), { algorithms: ["HS256"] });
    return payload.token_use === "refresh" ? (payload.sub ?? null) : null;
  } catch {
    return null;
  }
}

export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const [scheme, token] = request.headers.get("authorization")?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

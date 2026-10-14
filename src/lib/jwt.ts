import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

// Deux clés distinctes : un access token ne peut pas servir de refresh token, et inversement.
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET manquant ou trop court");
  return new TextEncoder().encode(secret);
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_REFRESH_SECRET manquant ou trop court");
  if (secret === process.env.JWT_SECRET) throw new Error("JWT_REFRESH_SECRET doit être différent de JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export function signToken(userId: string, expiresIn: string) {
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

// Refresh token : JWT signé avec sa propre clé, identifiant unique (jti) et expiration absolue de la session.
// Il reste aussi enregistré en base (empreinte) pour pouvoir être révoqué : voir auth.service.
export function signRefreshToken(userId: string, expiresAt: Date) {
  return new SignJWT({ token_use: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getRefreshSecret());
}

// Id de l'utilisateur si la signature (clé de refresh) et l'expiration sont valides, sinon null.
export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret(), { algorithms: ["HS256"] });
    return payload.token_use === "refresh" ? (payload.sub ?? null) : null;
  } catch {
    return null;
  }
}

// Id de l'utilisateur à partir de l'en-tête « Authorization: Bearer <token> ».
// null si l'en-tête est absent, ou si le token est invalide, falsifié ou expiré.
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const [scheme, token] = request.headers.get("authorization")?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

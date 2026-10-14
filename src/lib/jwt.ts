import "server-only";
import { SignJWT, jwtVerify } from "jose";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET manquant ou trop court");
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

// Id de l'utilisateur à partir de l'en-tête « Authorization: Bearer <token> »,
// ou null si l'en-tête est absent, mal formé, ou si le token est invalide / expiré / falsifié.
export async function getUserIdFromRequest(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  if (!match) return null;

  try {
    return await verifyToken(match[1]);
  } catch {
    return null;
  }
}

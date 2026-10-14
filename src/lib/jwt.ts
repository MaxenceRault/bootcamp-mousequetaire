import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { getConfig } from "@/lib/config";

function getSecret() {
  // Présence et longueur (≥ 32) vérifiées par getConfig.
  return new TextEncoder().encode(getConfig().jwtSecret);
}

// Durée de vie : JWT_EXPIRES_IN (ex. « 1h »), passé l'utilisateur doit se reconnecter.
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

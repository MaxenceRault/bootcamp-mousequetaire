import "server-only";
import { connection } from "next/server";
import { getConfig } from "@/lib/config";
import { getUserIdFromRequest } from "@/lib/jwt";
import { isRateLimited } from "@/lib/rateLimit";
import { getMyProfile, ProfileError, setMyAvatar, updateMyProfile } from "@/lib/services/user.service";
import { PROFILE_IMAGE_MAX_BYTES, profileImageSchema, updateProfileSchema } from "@/schemas/user.schema";

// GET /api/v1/users/me : profil de l'utilisateur connecté + ses récits.
export async function getMeController(request: Request) {
  // Réponse propre à chaque requête : jamais pré-calculée au build (cacheComponents), où l'env n'existe pas.
  await connection();
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  try {
    return Response.json(await getMyProfile(userId));
  } catch (error) {
    return handleError(error);
  }
}

// PATCH /api/v1/users/me : modification du nom, du pseudo et de la ville.
export async function updateMeController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  // Par utilisateur : limite les écritures en boucle et la recherche de pseudos pris (409).
  const { max, windowMs } = getConfig().rateLimits.profileUpdate;
  if (isRateLimited(`users:update:${userId}`, max, windowMs)) {
    return errorResponse(429, "TOO_MANY_REQUESTS");
  }

  const body = updateProfileSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json({ user: await updateMyProfile(userId, body.data) });
  } catch (error) {
    return handleError(error);
  }
}

// Marge pour l'enveloppe multipart autour de l'image.
const MAX_IMAGE_BODY_BYTES = PROFILE_IMAGE_MAX_BYTES + 64 * 1024;

// PUT (multipart, champ « image ») / DELETE /api/v1/users/me/avatar (Bearer)
// → 200 { user } : photo de profil de l'utilisateur connecté.
export function avatarController(upload: boolean) {
  return async (request: Request) => {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return errorResponse(401, "UNAUTHORIZED");

    const { max, windowMs } = getConfig().rateLimits.profileUpdate;
    if (isRateLimited(`profile:image:${userId}`, max, windowMs)) return errorResponse(429, "TOO_MANY_REQUESTS");

    let image: File | null = null;
    if (upload) {
      const contentLength = Number(request.headers.get("content-length"));
      if (!contentLength) return errorResponse(411, "LENGTH_REQUIRED");
      if (contentLength > MAX_IMAGE_BODY_BYTES) return errorResponse(413, "PAYLOAD_TOO_LARGE");

      const form = await request.formData().catch(() => null);
      const body = profileImageSchema.safeParse(form ? Object.fromEntries(form) : null);
      if (!body.success) return errorResponse(400, "INVALID_INPUT");
      image = body.data.image;
    }

    try {
      return Response.json({ user: await setMyAvatar(userId, image) });
    } catch (error) {
      return handleError(error);
    }
  };
}

function readJson(request: Request) {
  return request.json().catch(() => null);
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof ProfileError) {
    // Compte introuvable avec un token valide : traité comme une session invalide.
    if (error.code === "USERNAME_TAKEN") return errorResponse(409, "USERNAME_TAKEN");
    if (error.code === "INVALID_INPUT") return errorResponse(400, "INVALID_INPUT");
    return errorResponse(401, "UNAUTHORIZED");
  }

  console.error(
    JSON.stringify({
      level: "error",
      scope: "users",
      message: String((error as { message?: unknown })?.message ?? "unknown error"),
    }),
  );
  return errorResponse(500, "INTERNAL_ERROR");
}

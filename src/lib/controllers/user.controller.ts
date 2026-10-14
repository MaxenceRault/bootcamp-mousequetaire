import "server-only";
import { connection } from "next/server";
import { getConfig } from "@/lib/config";
import { getUserIdFromRequest } from "@/lib/jwt";
import { isRateLimited } from "@/lib/rateLimit";
import { getMyProfile, ProfileError, updateMyProfile } from "@/lib/services/user.service";
import { updateProfileSchema } from "@/schemas/user.schema";

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

function readJson(request: Request) {
  return request.json().catch(() => null);
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof ProfileError) {
    // Compte introuvable avec un token valide : traité comme une session invalide.
    return error.code === "USERNAME_TAKEN"
      ? errorResponse(409, "USERNAME_TAKEN")
      : errorResponse(401, "UNAUTHORIZED");
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

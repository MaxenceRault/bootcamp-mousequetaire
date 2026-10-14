import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { searchPlaces } from "@/lib/services/location.service";

// GET /api/v1/locations?q=kyo → { places: [...] } (8 suggestions max)
const querySchema = z
  .object({
    q: z.string().trim().min(2).max(60),
  })
  .strict();

// Données quasi statiques : le navigateur garde une recherche en cache une heure
// (court : un changement de la liste, ex. un pays retiré, est visible rapidement).
const CACHE_HEADERS = { "Cache-Control": "public, max-age=3600" };

export async function locationsController(request: Request) {
  // Réponse propre à chaque requête : jamais pré-calculée au build (cacheComponents), où l'env n'existe pas.
  await connection();
  // Chaque recherche parcourt ~150 000 villes : limite anti-abus par IP.
  const { max, windowMs } = getConfig().rateLimits.locations;
  if (isRateLimited(`locations:${clientIp(request)}`, max, windowMs)) {
    return Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  try {
    return Response.json({ places: searchPlaces(query.data.q) }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope: "locations",
        message: String((error as { message?: unknown })?.message ?? "unknown error"),
      }),
    );
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

import "server-only";
import { z } from "zod";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { searchPlaces } from "@/lib/services/location.service";

// GET /api/locations?q=kyo → { places: [...] } (8 suggestions max)
const querySchema = z
  .object({
    q: z.string().trim().min(2).max(60),
  })
  .strict();

const ONE_MINUTE = 60 * 1000;

// Données statiques : le navigateur peut garder une recherche en cache un jour.
const CACHE_HEADERS = { "Cache-Control": "public, max-age=86400" };

export function locationsController(request: Request) {
  // Chaque recherche parcourt ~150 000 villes : limite anti-abus par IP.
  if (isRateLimited(`locations:${clientIp(request)}`, 60, ONE_MINUTE)) {
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

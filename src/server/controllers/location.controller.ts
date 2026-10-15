import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { getConfig } from "@/server/config";
import { clientIp, isRateLimited } from "@/server/rateLimit";
import { searchPlaces } from "@/server/services/location.service";
import { logError } from "@/server/logger";

// GET /api/v1/locations?q=kyo (8 suggestions max)
const querySchema = z
  .object({
    q: z.string().trim().min(2).max(60),
  })
  .strict();

// Cache navigateur court : un changement de la liste (ex. pays retiré) se voit vite.
const CACHE_HEADERS = { "Cache-Control": "public, max-age=3600" };

export async function locationsController(request: Request) {
  // Jamais pré-calculé au build (cacheComponents).
  await connection();
  // ~150 000 villes parcourues par recherche : limite anti-abus par IP.
  const { max, windowMs } = getConfig().rateLimits.locations;
  if (isRateLimited(`locations:${clientIp(request)}`, max, windowMs)) {
    return Response.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "INVALID_INPUT" }, { status: 400 });

  try {
    return Response.json({ places: searchPlaces(query.data.q) }, { headers: CACHE_HEADERS });
  } catch (error) {
    logError("locations", error);
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

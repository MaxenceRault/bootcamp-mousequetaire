import "server-only";
import { getConfig } from "@/server/config";

const hits = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();

  if (hits.size > 10_000) {
    for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
  }

  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

// Chaque proxy ajoute l'IP qu'il voit à la FIN de X-Forwarded-For ; les premières entrées peuvent être
// inventées par le client. On lit celle du dernier proxy de confiance (TRUSTED_PROXY_HOPS).
export function clientIp(request: Request) {
  const forwarded = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return forwarded[forwarded.length - getConfig().trustedProxyHops] ?? "unknown";
}

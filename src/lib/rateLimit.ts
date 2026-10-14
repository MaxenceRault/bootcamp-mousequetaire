import "server-only";
import { getConfig } from "@/lib/config";

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

// IP du client, utilisée comme clé de rate limit.
// X-Forwarded-For = « ip1, ip2, …, ipN » : chaque proxy ajoute l'adresse qu'il voit À LA FIN. Les premières
// entrées peuvent être écrites par le client lui-même (une valeur différente à chaque requête contournerait
// le rate limit) : on lit donc l'entrée ajoutée par le dernier proxy de confiance (TRUSTED_PROXY_HOPS).
export function clientIp(request: Request) {
  const forwarded = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return forwarded[forwarded.length - getConfig().trustedProxyHops] ?? "unknown";
}

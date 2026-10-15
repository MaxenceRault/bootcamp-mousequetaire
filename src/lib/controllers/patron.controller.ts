import "server-only";
import { getUserIdFromRequest } from "@/lib/jwt";
import { logError } from "@/lib/logger";
import { getPatronStatus, handleBuyMeACoffeeWebhook, PatronError } from "@/lib/services/patron.service";

// Un événement Buy Me a Coffee fait quelques Ko.
const MAX_WEBHOOK_BYTES = 64 * 1024;

// GET /api/v1/users/me/patron (Bearer) → { enabled, isPatron, email, pageUrl }
export async function getPatronController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  try {
    return Response.json(await getPatronStatus(userId));
  } catch (error) {
    // Compte introuvable ou banni avec un token valide : traité comme une session invalide.
    if (error instanceof PatronError) return errorResponse(401, "UNAUTHORIZED");
    return internalError(error);
  }
}

// POST /api/v1/payments/buymeacoffee (appelé par Buy Me a Coffee uniquement) : signature vérifiée sur le corps brut.
export async function buyMeACoffeeWebhookController(request: Request) {
  const signature = request.headers.get("x-signature-sha256");
  if (!signature) return errorResponse(401, "INVALID_SIGNATURE");
  if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) return errorResponse(413, "PAYLOAD_TOO_LARGE");

  // Corps brut obligatoire : la signature porte sur les octets exacts envoyés.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_WEBHOOK_BYTES) return errorResponse(413, "PAYLOAD_TOO_LARGE");

  try {
    await handleBuyMeACoffeeWebhook(rawBody, signature);
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof PatronError) {
      if (error.code === "UNAVAILABLE") return errorResponse(503, "PAYMENT_UNAVAILABLE");
      if (error.code === "INVALID_SIGNATURE") return errorResponse(401, "INVALID_SIGNATURE");
      return errorResponse(400, "INVALID_INPUT");
    }
    // 500 : Buy Me a Coffee renverra l'événement (traitement idempotent).
    return internalError(error);
  }
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function internalError(error: unknown) {
  logError("patron", error);
  return errorResponse(500, "INTERNAL_ERROR");
}

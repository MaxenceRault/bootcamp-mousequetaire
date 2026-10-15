import "server-only";
import { getConfig } from "@/lib/config";
import { getUserIdFromRequest } from "@/lib/jwt";
import { isRateLimited } from "@/lib/rateLimit";
import {
  getPatronPaymentResult,
  getPatronStatus,
  handlePaymentWebhook,
  PatronError,
  startPatronCheckout,
} from "@/lib/services/patron.service";
import { checkoutSessionIdSchema } from "@/schemas/patron.schema";

// GET /api/v1/users/me/patron (Bearer) → { enabled, isPatron, priceCents, currency }
// GET /api/v1/users/me/patron?session_id=cs_… → { payment: { status, amountCents, currency } | null } (retour de Stripe)
export async function getPatronController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const rawSessionId = new URL(request.url).searchParams.get("session_id");
  try {
    if (rawSessionId !== null) {
      const sessionId = checkoutSessionIdSchema.safeParse(rawSessionId);
      if (!sessionId.success) return errorResponse(400, "INVALID_INPUT");
      return Response.json({ payment: await getPatronPaymentResult(userId, sessionId.data) });
    }
    return Response.json(await getPatronStatus(userId));
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/v1/users/me/patron/checkout (Bearer) → 200 { url } : page de paiement Stripe du rôle mécène.
export async function createPatronCheckoutController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const { max, windowMs } = getConfig().rateLimits.patronCheckout;
  if (isRateLimited(`patron:checkout:${userId}`, max, windowMs)) return errorResponse(429, "TOO_MANY_REQUESTS");

  // Adresse de retour : URL publique configurée (production), sinon l'origine de la requête (dev).
  const baseUrl = getConfig().appUrl ?? new URL(request.url).origin;

  try {
    return Response.json({ url: await startPatronCheckout(userId, baseUrl) });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/v1/payments/webhook (appelé par Stripe uniquement) : signature vérifiée sur le corps brut.
export async function paymentWebhookController(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return errorResponse(400, "INVALID_SIGNATURE");

  // Corps brut obligatoire : la signature porte sur les octets exacts envoyés par Stripe.
  const rawBody = await request.text();

  try {
    await handlePaymentWebhook(rawBody, signature);
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof PatronError) return errorResponse(400, "INVALID_SIGNATURE");
    // 500 : Stripe renverra l'événement plus tard (traitement idempotent).
    return internalError(error);
  }
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof PatronError) {
    if (error.code === "ALREADY_PATRON") return errorResponse(409, "ALREADY_PATRON");
    if (error.code === "UNAVAILABLE") return errorResponse(503, "PAYMENT_UNAVAILABLE");
    // Compte introuvable avec un token valide : traité comme une session invalide.
    return errorResponse(401, "UNAUTHORIZED");
  }
  return internalError(error);
}

// Détail dans les logs serveur uniquement ; le client reçoit un code générique.
function internalError(error: unknown) {
  console.error(
    JSON.stringify({
      level: "error",
      scope: "patron",
      message: String((error as { message?: unknown })?.message ?? "unknown error"),
    }),
  );
  return errorResponse(500, "INTERNAL_ERROR");
}

import "server-only";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { ADMIN_ROLE, findUserRole, grantPatronRole, PATRON_ROLE } from "@/lib/repositories/patron.repository";
import {
  createCheckoutSession,
  isPaymentConfigured,
  retrieveCheckoutSession,
  toSessionInfo,
  verifyWebhookEvent,
} from "@/lib/repositories/payment.repository";
import { checkoutSessionIdSchema } from "@/schemas/patron.schema";

export class PatronError extends Error {
  constructor(public readonly code: "UNAVAILABLE" | "ALREADY_PATRON" | "NOT_FOUND" | "INVALID_SIGNATURE") {
    super(code);
  }
}

// Type de paiement inscrit dans la session Stripe (relu par le webhook).
const PAYMENT_KIND = "patron_role";
const CURRENCY = "eur";

export type PatronStatus = { enabled: boolean; isPatron: boolean; priceCents: number; currency: string };

// État affiché sur la page « Devenir mécène ».
export async function getPatronStatus(userId: string): Promise<PatronStatus> {
  const role = await findUserRole(userId);
  if (role === null) throw new PatronError("NOT_FOUND");
  return {
    enabled: isPaymentConfigured(),
    // Un admin a déjà tous les droits : la page lui indique qu'il n'a rien à acheter.
    isPatron: role === PATRON_ROLE || role === ADMIN_ROLE,
    priceCents: getConfig().patronPriceCents,
    currency: CURRENCY,
  };
}

// Page de paiement Stripe pour le rôle mécène. Le prix vient du serveur (jamais du client).
export async function startPatronCheckout(userId: string, baseUrl: string): Promise<string> {
  const role = await findUserRole(userId);
  if (role === null) throw new PatronError("NOT_FOUND");
  // Déjà mécène, ou admin (l'achat remplacerait son rôle) : rien à payer.
  if (role === PATRON_ROLE || role === ADMIN_ROLE) throw new PatronError("ALREADY_PATRON");

  const session = await createCheckoutSession({
    kind: PAYMENT_KIND,
    userId,
    productName: "Rôle mécène Brb",
    amountCents: getConfig().patronPriceCents,
    currency: CURRENCY,
    // {CHECKOUT_SESSION_ID} est remplacé par Stripe au retour.
    successUrl: `${baseUrl}/patron/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/patron?canceled=1`,
  });
  if (!session) throw new PatronError("UNAVAILABLE");
  return session.url;
}

// Données de l'événement : revalidées même si la signature est valide (format, statut, type de paiement).
const paidPatronSchema = z.object({
  id: checkoutSessionIdSchema,
  amountCents: z.number().int().positive(),
  currency: z.string().regex(/^[a-z]{3}$/),
  paymentStatus: z.literal("paid"),
  kind: z.literal(PAYMENT_KIND),
  userId: z.uuid(),
});

// Webhook Stripe : le rôle est attribué uniquement quand Stripe confirme que l'argent est reçu
// (paiement immédiat, ou différé pour certains moyens de paiement). Les autres événements sont ignorés.
export async function handlePaymentWebhook(rawBody: string, signature: string) {
  const event = verifyWebhookEvent(rawBody, signature);
  if (!event) throw new PatronError("INVALID_SIGNATURE");

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return;

  const payment = paidPatronSchema.safeParse(toSessionInfo(event.data.object));
  if (!payment.success) return;

  await grantPatronRole({
    stripe_session_id: payment.data.id,
    user_id: payment.data.userId,
    amount_cents: payment.data.amountCents,
    currency: payment.data.currency,
  });
}

export type PatronPaymentResult = { status: "paid" | "pending"; amountCents: number; currency: string };

// Page de retour : état lu chez Stripe (le retour du navigateur ne prouve rien). Seul l'acheteur peut la voir.
export async function getPatronPaymentResult(userId: string, sessionId: string): Promise<PatronPaymentResult | null> {
  const session = await retrieveCheckoutSession(sessionId);
  if (!session || session.kind !== PAYMENT_KIND || session.userId !== userId || !session.amountCents || !session.currency) {
    return null;
  }
  return {
    status: session.paymentStatus === "paid" ? "paid" : "pending",
    amountCents: session.amountCents,
    currency: session.currency,
  };
}

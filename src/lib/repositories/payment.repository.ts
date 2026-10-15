import "server-only";
import type Stripe from "stripe";
import { getConfig } from "@/lib/config";
import { logError } from "@/lib/logger";
import { getStripe } from "@/utils/stripe";

// Accès à Stripe (service de paiement externe), comme les autres repositories pour la base et le stockage.

export type CheckoutRequest = {
  kind: string;
  userId: string;
  productName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
};

export function isPaymentConfigured() {
  return getStripe() !== null;
}

// Page de paiement hébergée par Stripe : aucune donnée bancaire ne passe par l'app.
// Pas de payment_method_types : les moyens de paiement sont ceux activés dans le tableau de bord Stripe
// (carte, Apple Pay, Google Pay, PayPal…). null si Stripe n'est pas configuré ou refuse la demande.
export async function createCheckoutSession(request: CheckoutRequest): Promise<{ id: string; url: string } | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: request.currency,
            unit_amount: request.amountCents,
            product_data: { name: request.productName },
          },
        },
      ],
      client_reference_id: request.userId,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      // Relu par le webhook pour savoir quoi accorder et à qui.
      metadata: { kind: request.kind, user_id: request.userId },
    });
  } catch (error) {
    // Clé invalide, Stripe indisponible… : « paiement indisponible » pour le client, détail dans les logs.
    const { type, code } = error as { type?: string; code?: string };
    logError("payments", `checkout_failed type=${type} code=${code}`);
    return null;
  }

  return session.url ? { id: session.id, url: session.url } : null;
}

// Événement Stripe dont la signature (STRIPE_WEBHOOK_SECRET) est valide, sinon null.
export function verifyWebhookEvent(rawBody: string, signature: string): Stripe.Event | null {
  const stripe = getStripe();
  const secret = getConfig().stripe?.webhookSecret;
  if (!stripe || !secret) return null;

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

export type CheckoutSessionInfo = {
  id: string;
  amountCents: number | null;
  currency: string | null;
  paymentStatus: Stripe.Checkout.Session.PaymentStatus;
  kind: string | null;
  userId: string | null;
};

export function toSessionInfo(session: Stripe.Checkout.Session): CheckoutSessionInfo {
  return {
    id: session.id,
    amountCents: session.amount_total,
    currency: session.currency,
    paymentStatus: session.payment_status,
    kind: session.metadata?.kind ?? null,
    userId: session.metadata?.user_id || null,
  };
}

// Session lue directement chez Stripe (source de vérité), null si elle n'existe pas.
export async function retrieveCheckoutSession(id: string): Promise<CheckoutSessionInfo | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    return toSessionInfo(await stripe.checkout.sessions.retrieve(id));
  } catch {
    return null;
  }
}

import "server-only";
import Stripe from "stripe";
import { getConfig } from "@/lib/config";

// Client Stripe (serveur uniquement : la clé secrète ne quitte jamais le serveur).
// null si le paiement n'est pas configuré (STRIPE_SECRET_KEY absente).
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export function getStripe(): Stripe | null {
  const stripe = getConfig().stripe;
  if (!stripe) return null;
  globalForStripe.stripe ??= new Stripe(stripe.secretKey, { maxNetworkRetries: 2, timeout: 20_000 });
  return globalForStripe.stripe;
}

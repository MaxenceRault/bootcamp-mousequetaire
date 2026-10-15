import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getBuyMeACoffeeConfig } from "@/lib/config";
import { logInfo } from "@/lib/logger";
import {
  findActiveUserIdByEmail,
  findUserEmail,
  recordDonationAndGrantPatron,
  refundDonationAndRevokePatron,
} from "@/lib/repositories/patron.repository";
import { findUserAccess } from "@/lib/repositories/user.repository";
import { bmcDonationSchema, bmcEventSchema, bmcSignatureSchema } from "@/schemas/patron.schema";

export class PatronError extends Error {
  constructor(public readonly code: "UNAVAILABLE" | "NOT_FOUND" | "INVALID_SIGNATURE" | "INVALID_PAYLOAD") {
    super(code);
  }
}

export type PatronStatus = {
  enabled: boolean;
  minEur: number | null;
  isPatron: boolean;
  // Le don est rattaché au compte par cette adresse : affichée seulement à son titulaire.
  email: string | null;
  pageUrl: string | null;
};

export async function getPatronStatus(userId: string): Promise<PatronStatus> {
  const [access, email] = await Promise.all([findUserAccess(userId), findUserEmail(userId)]);
  if (!access || access.banned_at) throw new PatronError("NOT_FOUND");

  const bmc = getBuyMeACoffeeConfig();
  return {
    enabled: bmc !== null,
    minEur: bmc?.patronMinEur ?? null,
    isPatron: access.role === "patron" || access.role === "admin",
    email,
    pageUrl: bmc?.pageUrl ?? null,
  };
}

// Rôle attribué / retiré uniquement ici, sur un événement signé par Buy Me a Coffee.
export async function handleBuyMeACoffeeWebhook(rawBody: string, signature: string) {
  const bmc = getBuyMeACoffeeConfig();
  if (!bmc) throw new PatronError("UNAVAILABLE");
  if (!isValidSignature(rawBody, signature, bmc.webhookSecret)) throw new PatronError("INVALID_SIGNATURE");

  const event = bmcEventSchema.safeParse(safeJson(rawBody));
  if (!event.success) throw new PatronError("INVALID_PAYLOAD");
  const { type, live_mode: liveMode } = event.data;

  // Événements de test du tableau de bord (données d'exemple) : jamais pris en compte en production.
  if (!liveMode && process.env.NODE_ENV === "production") return logInfo("patron", { ignored: type, reason: "test_event" });
  if (type !== "donation.created" && type !== "donation.refunded") return logInfo("patron", { ignored: type });

  const donation = bmcDonationSchema.safeParse(event.data.data);
  if (!donation.success) throw new PatronError("INVALID_PAYLOAD");
  const { id, status, amount, currency, supporter_email: email } = donation.data;

  if (type === "donation.refunded") {
    const revoked = await refundDonationAndRevokePatron(id);
    return logInfo("patron", { event: type, paymentId: id, applied: revoked });
  }

  if (status !== "succeeded") return logInfo("patron", { ignored: type, paymentId: id, reason: "not_succeeded" });
  if (currency !== "EUR" || amount < bmc.patronMinEur) {
    return logInfo("patron", { ignored: type, paymentId: id, reason: "below_minimum_eur", amount, currency });
  }
  // Pas de compte Brb avec cet email : le don reste un simple don (jamais l'email dans les logs).
  const userId = email ? await findActiveUserIdByEmail(email) : null;
  if (!userId) return logInfo("patron", { ignored: type, paymentId: id, reason: "no_matching_account" });

  const recorded = await recordDonationAndGrantPatron({ bmcPaymentId: id, userId, amount, currency });
  logInfo("patron", { event: type, paymentId: id, applied: recorded });
}

function isValidSignature(rawBody: string, signature: string, secret: string) {
  if (!bmcSignatureSchema.safeParse(signature).success) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  // Comparaison à temps constant (même longueur garantie : 32 octets).
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

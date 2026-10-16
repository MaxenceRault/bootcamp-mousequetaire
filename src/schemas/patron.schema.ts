import { z } from "zod";

// Webhook Buy Me a Coffee : looseObject voulu (exception à strictObject), le corps est signé et Buy Me a Coffee peut ajouter des champs.
// Seuls les champs utilisés sont validés ; le reste est ignoré.
export const bmcEventSchema = z.looseObject({
  type: z.string().max(64),
  live_mode: z.boolean(),
  data: z.unknown(),
});

export const bmcDonationSchema = z.looseObject({
  id: z.number().int().positive(),
  status: z.enum(["succeeded", "refunded"]),
  amount: z.coerce.number().positive().max(100_000),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((currency) => currency.toUpperCase()),
  // Les emails des comptes Biirb sont en minuscules.
  supporter_email: z.string().trim().toLowerCase().max(254).pipe(z.email()).nullish(),
});

export type BmcDonation = z.infer<typeof bmcDonationSchema>;

// Achat d'un article de la boutique (pass voyage) : mêmes champs que le don + les articles achetés.
export const bmcExtraPurchaseSchema = bmcDonationSchema.extend({
  extras: z.array(z.looseObject({ id: z.number().int().positive() })).max(50).default([]),
});

export type BmcExtraPurchase = z.infer<typeof bmcExtraPurchaseSchema>;

// HMAC-SHA256 en hexadécimal.
export const bmcSignatureSchema = z.string().regex(/^[a-f0-9]{64}$/i);

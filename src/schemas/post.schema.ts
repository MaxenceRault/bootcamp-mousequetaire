import { z } from "zod";
import { archetypeSlugSchema } from "@/schemas/archetype.schema";

// Alignées sur la table post.
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_TAGS = 10;

const countryCode = z.string().regex(/^[A-Z]{2}$/);
const stateCode = z.string().regex(/^[A-Za-z0-9-]{1,10}$/);
const cityName = z.string().trim().min(1).max(100);

// Une ville est toujours dans une région.
export const placeSchema = z
  .object({
    country: countryCode,
    state: stateCode.optional(),
    city: cityName.optional(),
  })
  .strict()
  .refine((place) => !place.city || place.state);

// Un tag arrive en JSON : {"country":"JP","state":"26","city":"Kyoto"}.
const tagSchema = z
  .string()
  .max(300)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({ code: "custom", message: "INVALID_JSON" });
      return z.NEVER;
    }
  })
  .pipe(placeSchema);

export const createPostSchema = z
  .object({
    // Saisi dans un textarea : retours à la ligne ramenés à un espace.
    title: z
      .string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(1).max(100)),
    photo: z.file().min(1).max(PHOTO_MAX_BYTES).mime([...PHOTO_TYPES]),
    photoAlt: z.string().trim().min(1).max(200),
    shortDescription: z.string().trim().min(1).max(252),
    longDescription: z.string().trim().min(1).max(10_000),
    destinationCountry: countryCode,
    destinationState: stateCode.optional(),
    destinationCity: cityName.optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    // Existence et état actif vérifiés par le service.
    archetype: archetypeSlugSchema,
    tags: z.array(tagSchema).max(MAX_TAGS).default([]),
  })
  .strict()
  // Dates AAAA-MM-JJ : l'ordre des chaînes est chronologique.
  .refine((post) => post.endDate >= post.startDate, { path: ["endDate"] })
  .refine((post) => !post.destinationCity || post.destinationState, { path: ["destinationCity"] });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type PlaceInput = z.infer<typeof placeSchema>;

export const FEED_MAX_LIMIT = 20;

export const feedQuerySchema = z
  .object({
    archetype: archetypeSlugSchema.optional(),
    // Borné à l'entier max de Postgres.
    cursor: z.coerce.number().int().positive().max(2_147_483_647).optional(),
    limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).optional(),
  })
  .strict();

// Sans zéro initial ni autre caractère.
export const postIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,9}$/)
  .transform(Number)
  .pipe(z.number().int().max(2_147_483_647));

export const updatePostSchema = z
  .object({
    hidden: z.boolean(),
  })
  .strict();

export const MAX_REACTION_POST_IDS = 50;

export const viewerReactionsQuerySchema = z
  .object({
    postIds: z
      .string()
      .regex(/^[1-9][0-9]{0,9}(,[1-9][0-9]{0,9})*$/)
      .transform((value) => [...new Set(value.split(",").map(Number))])
      .pipe(z.array(z.number().int().max(2_147_483_647)).min(1).max(MAX_REACTION_POST_IDS)),
  })
  .strict();

export const searchQuerySchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(2).max(100));

// Mêmes règles que la contrainte SQL post_slug_format.
export const postSlugSchema = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .refine((slug) => !/^[0-9]+$/.test(slug));

// Affiché à l'admin en texte brut.
export const reportPostSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || null)
      .optional(),
  })
  .strict();

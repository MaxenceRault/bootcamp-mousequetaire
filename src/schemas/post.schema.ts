import { z } from "zod";
import { POST_ARCHETYPES } from "@/lib/posts";

// Limites alignées sur la table post (db/migrations/) et le contrôle fait par post.service.
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_TAGS = 10;

const countryCode = z.string().regex(/^[A-Z]{2}$/);
const stateCode = z.string().regex(/^[A-Za-z0-9-]{1,10}$/);
const cityName = z.string().trim().min(1).max(100);

// Lieu de country-state-city : un pays, éventuellement une région et une ville (toujours dans une région).
export const placeSchema = z
  .object({
    country: countryCode,
    state: stateCode.optional(),
    city: cityName.optional(),
  })
  .strict()
  .refine((place) => !place.city || place.state);

// Un tag arrive en JSON dans le formulaire : {"country":"JP","state":"26","city":"Kyoto"}.
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

// Corps multipart de POST /api/v1/posts (allowlist : tout champ inconnu est rejeté).
export const createPostSchema = z
  .object({
    // Le titre est saisi dans un textarea : retours à la ligne et espaces multiples ramenés à un espace.
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
    archetype: z.enum(POST_ARCHETYPES),
    tags: z.array(tagSchema).max(MAX_TAGS).default([]),
  })
  .strict()
  // Dates au format AAAA-MM-JJ : la comparaison de chaînes suit l'ordre chronologique.
  .refine((post) => post.endDate >= post.startDate, { path: ["endDate"] })
  .refine((post) => !post.destinationCity || post.destinationState, { path: ["destinationCity"] });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type PlaceInput = z.infer<typeof placeSchema>;

// Paramètres de GET /api/v1/posts (feed public, chargement infini).
export const FEED_MAX_LIMIT = 20;

export const feedQuerySchema = z
  .object({
    archetype: z.enum(POST_ARCHETYPES).optional(),
    // Id du dernier post déjà affiché ; borné à l'entier max de Postgres (colonne integer).
    cursor: z.coerce.number().int().positive().max(2_147_483_647).optional(),
    limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).optional(),
  })
  .strict();

// Id d'un post dans l'URL (/post/5, /api/v1/posts/5) : entier positif, sans zéro initial ni autre caractère.
export const postIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,9}$/)
  .transform(Number)
  .pipe(z.number().int().max(2_147_483_647));

// Corps de PATCH /api/v1/posts/{id} : seule la visibilité est modifiable pour l'instant.
export const updatePostSchema = z
  .object({
    hidden: z.boolean(),
  })
  .strict();

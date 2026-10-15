import { z } from "zod";
import { archetypeSlugSchema } from "@/schemas/archetype.schema";

// Alignées sur la table post.
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_TAGS = 10;
export const LONG_DESCRIPTION_MAX = 10_000;
// Photos insérées dans le récit : réduites par le navigateur avant l'envoi (corps de requête limité).
export const BODY_PHOTO_MAX = 5;
export const BODY_PHOTO_MAX_BYTES = 1024 * 1024;
// Tailles du texte proposées par l'éditeur (absente : taille normale).
export const BODY_FONT_SIZES = ["14px", "20px", "24px"] as const;

const countryCode = z.string().regex(/^[A-Z]{2}$/);
const stateCode = z.string().regex(/^[A-Za-z0-9-]{1,10}$/);
const cityName = z.string().trim().min(1).max(100);

// Une ville est toujours dans une région.
export const placeSchema = z
  .strictObject({
    country: countryCode,
    state: stateCode.optional(),
    city: cityName.optional(),
  })
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

// Récit mis en page : sous-ensemble du JSON de l'éditeur (TipTap), tout autre nœud ou attribut est refusé.
const markSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bold") }),
  z.strictObject({ type: z.literal("italic") }),
  z.strictObject({ type: z.literal("underline") }),
  z.strictObject({ type: z.literal("textStyle"), attrs: z.strictObject({ fontSize: z.enum(BODY_FONT_SIZES) }) }),
]);

const inlineSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("text"), text: z.string().min(1).max(LONG_DESCRIPTION_MAX), marks: z.array(markSchema).max(4).optional() }),
  z.strictObject({ type: z.literal("hardBreak") }),
]);

const paragraphSchema = z.strictObject({ type: z.literal("paragraph"), content: z.array(inlineSchema).max(2_000).optional() });

const listItemSchema = z.strictObject({ type: z.literal("listItem"), content: z.array(paragraphSchema).min(1).max(20) });
const bulletListSchema = z.strictObject({ type: z.literal("bulletList"), content: z.array(listItemSchema).min(1).max(200) });

// src « upload:N » : N-ième fichier de bodyPhotos, remplacé par l'URL du bucket côté serveur.
export const BODY_UPLOAD_PREFIX = "upload:";
const bodyImageSchema = z.strictObject({
  type: z.literal("image"),
  attrs: z.strictObject({
    src: z.string().regex(new RegExp(`^${BODY_UPLOAD_PREFIX}[0-${BODY_PHOTO_MAX - 1}]$`)),
    alt: z.string().trim().max(200).nullable(),
  }),
});

export const postBodySchema = z.strictObject({
  type: z.literal("doc"),
  content: z.array(z.discriminatedUnion("type", [paragraphSchema, bulletListSchema, bodyImageSchema])).min(1).max(1_000),
});

export type PostBody = z.infer<typeof postBodySchema>;
export type PostBodyBlock = PostBody["content"][number];
export type PostBodyInline = z.infer<typeof inlineSchema>;

// Le document arrive en JSON dans un champ du formulaire multipart.
const bodyFieldSchema = z
  .string()
  .max(300_000)
  .transform((value, context) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      context.addIssue({ code: "custom", message: "INVALID_JSON" });
      return z.NEVER;
    }
  })
  .pipe(postBodySchema);

export const createPostSchema = z
  .strictObject({
    // Saisi dans un textarea : retours à la ligne ramenés à un espace.
    title: z
      .string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(1).max(100)),
    photo: z.file().min(1).max(PHOTO_MAX_BYTES).mime([...PHOTO_TYPES]),
    photoAlt: z.string().trim().min(1).max(200),
    shortDescription: z.string().trim().min(1).max(252),
    body: bodyFieldSchema,
    bodyPhotos: z.array(z.file().min(1).max(BODY_PHOTO_MAX_BYTES).mime([...PHOTO_TYPES])).max(BODY_PHOTO_MAX).default([]),
    destinationCountry: countryCode,
    destinationState: stateCode.optional(),
    destinationCity: cityName.optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    // Existence et état actif vérifiés par le service.
    archetype: archetypeSlugSchema,
    tags: z.array(tagSchema).max(MAX_TAGS).default([]),
  })
  // Dates AAAA-MM-JJ : l'ordre des chaînes est chronologique.
  .refine((post) => post.endDate >= post.startDate, { path: ["endDate"] })
  .refine((post) => !post.destinationCity || post.destinationState, { path: ["destinationCity"] })
  // Chaque photo envoyée est placée exactement une fois dans le récit.
  .refine(
    (post) => {
      const sources = post.body.content.flatMap((block) => (block.type === "image" ? [block.attrs.src] : []));
      const indexes = new Set(sources.map((src) => Number(src.slice(BODY_UPLOAD_PREFIX.length))));
      return sources.length === post.bodyPhotos.length && indexes.size === sources.length && [...indexes].every((index) => index < sources.length);
    },
    { path: ["bodyPhotos"] },
  );

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type PlaceInput = z.infer<typeof placeSchema>;

export const FEED_MAX_LIMIT = 20;

export const feedQuerySchema = z.strictObject({
  archetype: archetypeSlugSchema.optional(),
  // Borné à l'entier max de Postgres.
  cursor: z.coerce.number().int().positive().max(2_147_483_647).optional(),
  limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).optional(),
});

// Sans zéro initial ni autre caractère.
export const postIdSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,9}$/)
  .transform(Number)
  .pipe(z.number().int().max(2_147_483_647));

export const updatePostSchema = z.strictObject({
  hidden: z.boolean(),
});

export const MAX_REACTION_POST_IDS = 50;

export const viewerReactionsQuerySchema = z.strictObject({
  postIds: z
    .string()
    .regex(/^[1-9][0-9]{0,9}(,[1-9][0-9]{0,9})*$/)
    .transform((value) => [...new Set(value.split(",").map(Number))])
    .pipe(z.array(z.number().int().max(2_147_483_647)).min(1).max(MAX_REACTION_POST_IDS)),
});

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
export const reportPostSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .optional(),
});

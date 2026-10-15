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

// Récit mis en page : sous-ensemble du JSON de l'éditeur (TipTap), tout autre nœud ou attribut est refusé.
const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }).strict(),
  z.object({ type: z.literal("italic") }).strict(),
  z.object({ type: z.literal("underline") }).strict(),
  z.object({ type: z.literal("textStyle"), attrs: z.object({ fontSize: z.enum(BODY_FONT_SIZES) }).strict() }).strict(),
]);

const inlineSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1).max(LONG_DESCRIPTION_MAX), marks: z.array(markSchema).max(4).optional() }).strict(),
  z.object({ type: z.literal("hardBreak") }).strict(),
]);

const paragraphSchema = z.object({ type: z.literal("paragraph"), content: z.array(inlineSchema).max(2_000).optional() }).strict();

const listItemSchema = z.object({ type: z.literal("listItem"), content: z.array(paragraphSchema).min(1).max(20) }).strict();
const bulletListSchema = z.object({ type: z.literal("bulletList"), content: z.array(listItemSchema).min(1).max(200) }).strict();

// src « upload:N » : N-ième fichier de bodyPhotos, remplacé par l'URL du bucket côté serveur.
export const BODY_UPLOAD_PREFIX = "upload:";
const bodyImageSchema = z
  .object({
    type: z.literal("image"),
    attrs: z
      .object({
        src: z.string().regex(new RegExp(`^${BODY_UPLOAD_PREFIX}[0-${BODY_PHOTO_MAX - 1}]$`)),
        alt: z.string().trim().max(200).nullable(),
      })
      .strict(),
  })
  .strict();

export const postBodySchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.discriminatedUnion("type", [paragraphSchema, bulletListSchema, bodyImageSchema])).min(1).max(1_000),
  })
  .strict();

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
  .object({
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
  .strict()
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

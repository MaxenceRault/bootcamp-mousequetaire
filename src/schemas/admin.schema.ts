import { z } from "zod";
import { BANNED_KINDS, BANNED_REASONS } from "@/lib/moderationFilter";
import { USER_ROLES } from "@/lib/roles";

// 50 lignes par page.
const search = z.string().trim().min(1).max(60).optional();
const page = z.coerce.number().int().min(1).max(10_000).default(1);

export const adminUsersQuerySchema = z.object({ q: search, page }).strict();

export const adminPostsQuerySchema = z
  .object({ q: search, page, visibility: z.enum(["all", "visible", "hidden"]).default("all") })
  .strict();

export const userIdParamSchema = z.uuid();

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(USER_ROLES),
    banned: z.boolean(),
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0);

export const adminUpdatePostSchema = z.object({ hidden: z.boolean() }).strict();

export const adminCloseReportsSchema = z.object({ status: z.literal("dismissed") }).strict();

export const adminUpdateSettingsSchema = z
  .object({
    aiEnabled: z.boolean(),
    aiDailyCap: z.number().int().min(0).max(100_000),
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0);

// POST /api/v1/admin/banned-words : terme normalisé côté serveur (minuscules, sans accents).
export const adminCreateBannedWordSchema = z
  .object({
    term: z.string().trim().min(2).max(60),
    reason: z.enum(BANNED_REASONS),
    kind: z.enum(BANNED_KINDS),
  })
  .strict();

export type AdminCreateBannedWordInput = z.infer<typeof adminCreateBannedWordSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminUpdateSettingsInput = z.infer<typeof adminUpdateSettingsSchema>;

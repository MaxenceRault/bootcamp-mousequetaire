import { z } from "zod";
import { BANNED_KINDS, BANNED_REASONS } from "@/lib/moderationFilter";
import { USER_ROLES } from "@/lib/roles";

// 50 lignes par page.
const search = z.string().trim().min(1).max(60).optional();
const page = z.coerce.number().int().min(1).max(10_000).default(1);

export const adminUsersQuerySchema = z.strictObject({ q: search, page });

export const adminPostsQuerySchema = z.strictObject({ q: search, page, visibility: z.enum(["all", "visible", "hidden"]).default("all") });

export const userIdParamSchema = z.uuid();

export const adminUpdateUserSchema = z
  .strictObject({
    role: z.enum(USER_ROLES),
    banned: z.boolean(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0);

export const adminUpdatePostSchema = z.strictObject({ hidden: z.boolean() });

export const adminCloseReportsSchema = z.strictObject({ status: z.literal("dismissed") });

export const adminUpdateSettingsSchema = z
  .strictObject({
    aiEnabled: z.boolean(),
    aiDailyCap: z.number().int().min(0).max(100_000),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0);

// POST /api/v1/admin/banned-words : terme normalisé côté serveur (minuscules, sans accents).
export const adminCreateBannedWordSchema = z.strictObject({
  term: z.string().trim().min(2).max(60),
  reason: z.enum(BANNED_REASONS),
  kind: z.enum(BANNED_KINDS),
});

export type AdminCreateBannedWordInput = z.infer<typeof adminCreateBannedWordSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminUpdateSettingsInput = z.infer<typeof adminUpdateSettingsSchema>;

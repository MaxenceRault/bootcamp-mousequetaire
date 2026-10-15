import { z } from "zod";

// Même règle que la contrainte de la table archetype.
export const ARCHETYPE_SLUG_PATTERN = /^[a-z][a-z_]{0,39}$/;
export const archetypeSlugSchema = z.string().regex(ARCHETYPE_SLUG_PATTERN);

const label = z.string().trim().min(1).max(40);
const description = z
  .string()
  .trim()
  .max(200)
  .transform((value) => value || null);

// Slug calculé à partir du libellé s'il n'est pas fourni.
export const createArchetypeSchema = z.strictObject({
  label,
  description: description.optional(),
  slug: archetypeSlugSchema.optional(),
});

// Le slug ne change jamais : il sert dans les URL du feed.
export const updateArchetypeSchema = z
  .strictObject({
    label,
    description,
    isActive: z.boolean(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0);

export type CreateArchetypeInput = z.infer<typeof createArchetypeSchema>;
export type UpdateArchetypeInput = z.infer<typeof updateArchetypeSchema>;

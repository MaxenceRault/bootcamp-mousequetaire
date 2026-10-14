import { z } from "zod";

// Mêmes règles que les contraintes de la table users (db/migrations).
export const USERNAME_PATTERN = "^[a-z0-9_]{3,30}$";
const AVATAR_SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// PATCH /api/v1/users/me : le formulaire envoie toujours tous les champs.
export const updateProfileSchema = z
  .object({
    display_name: z.string().trim().min(1).max(60),
    username: z.string().trim().toLowerCase().regex(new RegExp(USERNAME_PATTERN)),
    // Chaîne vide = pas de ville.
    location: z
      .string()
      .trim()
      .max(80)
      .transform((value) => value || null),
    // Blobatar choisi ; null = avatar par défaut.
    avatar_seed: z.string().regex(AVATAR_SEED_PATTERN).nullable(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

import { z } from "zod";

// Mêmes règles que les contraintes de la table users (db/migrations).
export const USERNAME_PATTERN = "^[a-z0-9_]{3,30}$";
const AVATAR_SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Couleurs proposées pour le fond du blobatar (allowlist : aucune autre valeur CSS acceptée).
export const AVATAR_BACKGROUND_COLORS = [
  "#ffdad8",
  "#ffe8c2",
  "#fff3b0",
  "#d9f2d0",
  "#cfeee8",
  "#d4e5ef",
  "#dde2f3",
  "#ead8f5",
  "#e1e3e4",
  "#1a202c",
] as const;

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
    // Couleur de fond du blobatar ; null = fond neutre.
    avatar_background_color: z.enum(AVATAR_BACKGROUND_COLORS).nullable(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Photo de profil : mêmes formats que les photos de récits, 3 Mo max.
export const PROFILE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// PUT /api/v1/users/me/avatar (multipart, un seul champ « image »).
export const profileImageSchema = z
  .object({
    image: z.file().min(1).max(PROFILE_IMAGE_MAX_BYTES).mime([...PROFILE_IMAGE_TYPES]),
  })
  .strict();

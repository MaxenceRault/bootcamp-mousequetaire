import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

// bcrypt n'utilise que les 72 premiers OCTETS : au-delà, la fin du mot de passe serait ignorée sans erreur.
// Un caractère accentué ou un emoji compte pour plusieurs octets : on limite en octets, pas en caractères.
const BCRYPT_MAX_BYTES = 72;
const fitsBcrypt = (password: string) => new TextEncoder().encode(password).length <= BCRYPT_MAX_BYTES;

// POST /api/v1/auth/login
export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).refine(fitsBcrypt),
    remember: z.boolean(),
  })
  .strict();

// POST /api/v1/auth/register
export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    email,
    password: z.string().min(8).refine(fitsBcrypt),
  })
  .strict();

// POST /api/v1/auth/refresh et /api/v1/auth/logout : refresh token au format JWT (header.payload.signature).
export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string()
      .max(1000)
      .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  })
  .strict();

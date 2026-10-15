import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

// bcrypt ignore tout au-delà de 72 octets : limite en octets (accents et emojis en comptent plusieurs).
const BCRYPT_MAX_BYTES = 72;
const fitsBcrypt = (password: string) => new TextEncoder().encode(password).length <= BCRYPT_MAX_BYTES;

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).refine(fitsBcrypt),
  remember: z.boolean(),
});

export const registerSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  email,
  password: z.string().min(8).refine(fitsBcrypt),
});

// Valeur du cookie httpOnly du refresh token (JWT).
export const refreshTokenSchema = z
  .string()
  .max(1000)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

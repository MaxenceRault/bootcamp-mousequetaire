import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

// POST /api/v1/auth/login
export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(72),
    remember: z.boolean(),
  })
  .strict();

// POST /api/v1/auth/register
export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    email,
    password: z.string().min(8).max(72),
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

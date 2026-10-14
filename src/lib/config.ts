import "server-only";
import { z } from "zod";

// Configuration serveur, lue depuis les variables d'environnement (liste et exemples : .env.example).
// Validée au premier appel : une valeur absente ou invalide arrête la requête avec une erreur
// qui nomme la variable (jamais sa valeur). Lecture paresseuse pour ne pas casser le build.

// Durée au format de jose : nombre + unité (s, m, h, d), ex. « 1h ».
const duration = z.string().regex(/^\d+[smhd]$/);
const count = z.coerce.number().int().positive();
const seconds = z.coerce.number().int().positive();

const envSchema = z.object({
  // Cloud SQL (Postgres) : connexion IAM via le connecteur Google, donc pas de mot de passe de base.
  CLOUD_SQL_INSTANCE: z.string().regex(/^[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+$/),
  DB_USER: z.string().min(1),
  DB_NAME: z.string().min(1),
  JWT_SECRET: z.string().min(32),

  JWT_EXPIRES_IN: duration.default("1h"),
  // Durée de vie absolue d'une session (refresh token) : « Se souvenir de moi » coché ou non.
  REFRESH_TOKEN_REMEMBER_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  REFRESH_TOKEN_SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  // ≥ 10 (règle de sécurité du projet) ; au-delà de 14, chaque connexion devient très lente.
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  RATE_LIMIT_LOGIN_MAX: count.default(5),
  RATE_LIMIT_LOGIN_WINDOW_SECONDS: seconds.default(15 * 60),
  RATE_LIMIT_REFRESH_MAX: count.default(30),
  RATE_LIMIT_REFRESH_WINDOW_SECONDS: seconds.default(15 * 60),
  RATE_LIMIT_REGISTER_MAX: count.default(5),
  RATE_LIMIT_REGISTER_WINDOW_SECONDS: seconds.default(15 * 60),
  RATE_LIMIT_LOCATIONS_MAX: count.default(60),
  RATE_LIMIT_LOCATIONS_WINDOW_SECONDS: seconds.default(60),
  RATE_LIMIT_POST_CREATE_MAX: count.default(10),
  RATE_LIMIT_POST_CREATE_WINDOW_SECONDS: seconds.default(60 * 60),
  RATE_LIMIT_FEED_MAX: count.default(120),
  RATE_LIMIT_FEED_WINDOW_SECONDS: seconds.default(60),
  RATE_LIMIT_POST_EDIT_MAX: count.default(30),
  RATE_LIMIT_POST_EDIT_WINDOW_SECONDS: seconds.default(15 * 60),
  RATE_LIMIT_PROFILE_UPDATE_MAX: count.default(10),
  RATE_LIMIT_PROFILE_UPDATE_WINDOW_SECONDS: seconds.default(15 * 60),
});

export type RateLimit = { max: number; windowMs: number };

export type ServerConfig = {
  db: { instanceConnectionName: string; user: string; database: string };
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenTtlMs: { remember: number; session: number };
  bcryptSaltRounds: number;
  rateLimits: Record<"login" | "refresh" | "register" | "locations" | "feed" | "postCreate" | "postEdit" | "profileUpdate", RateLimit>;
};

let config: ServerConfig | null = null;

export function getConfig(): ServerConfig {
  if (config) return config;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    // Log ici : l'erreur peut être interceptée plus haut (ex. vérification du token → simple 401).
    console.error(JSON.stringify({ level: "error", scope: "config", message: `invalid env: ${names}` }));
    throw new Error(`Configuration invalide ou manquante : ${names}`);
  }

  const env = parsed.data;
  const rateLimit = (max: number, windowSeconds: number) => ({ max, windowMs: windowSeconds * 1000 });

  config = {
    db: { instanceConnectionName: env.CLOUD_SQL_INSTANCE, user: env.DB_USER, database: env.DB_NAME },
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    refreshTokenTtlMs: {
      remember: env.REFRESH_TOKEN_REMEMBER_DAYS * 24 * 60 * 60 * 1000,
      session: env.REFRESH_TOKEN_SESSION_HOURS * 60 * 60 * 1000,
    },
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    rateLimits: {
      login: rateLimit(env.RATE_LIMIT_LOGIN_MAX, env.RATE_LIMIT_LOGIN_WINDOW_SECONDS),
      refresh: rateLimit(env.RATE_LIMIT_REFRESH_MAX, env.RATE_LIMIT_REFRESH_WINDOW_SECONDS),
      register: rateLimit(env.RATE_LIMIT_REGISTER_MAX, env.RATE_LIMIT_REGISTER_WINDOW_SECONDS),
      locations: rateLimit(env.RATE_LIMIT_LOCATIONS_MAX, env.RATE_LIMIT_LOCATIONS_WINDOW_SECONDS),
      feed: rateLimit(env.RATE_LIMIT_FEED_MAX, env.RATE_LIMIT_FEED_WINDOW_SECONDS),
      postCreate: rateLimit(env.RATE_LIMIT_POST_CREATE_MAX, env.RATE_LIMIT_POST_CREATE_WINDOW_SECONDS),
      postEdit: rateLimit(env.RATE_LIMIT_POST_EDIT_MAX, env.RATE_LIMIT_POST_EDIT_WINDOW_SECONDS),
      profileUpdate: rateLimit(env.RATE_LIMIT_PROFILE_UPDATE_MAX, env.RATE_LIMIT_PROFILE_UPDATE_WINDOW_SECONDS),
    },
  };
  return config;
}

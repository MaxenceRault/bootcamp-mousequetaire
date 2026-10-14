import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/jwt";
import {
  findRefreshTokenByHash,
  insertRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
} from "@/lib/repositories/refresh-token.repository";
import {
  createUser,
  findProfileById,
  findUserByEmail,
  type PublicUser,
} from "@/lib/repositories/user.repository";

const SALT_ROUNDS = 12;
// Access token (JWT) court : renouvelé avec le refresh token sans redemander le mot de passe.
const TOKEN_TTL = "1h";
// Durée de vie absolue du refresh token (et donc de la session) : « Se souvenir de moi » ou non.
const REFRESH_TTL_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_SESSION_MS = 24 * 60 * 60 * 1000;
const DUMMY_HASH = "$2b$12$5URWFGCO7h71Yp5EeqSYCuXKHN5/t8AqSI/rOUG9kjnDcqbw5EInm";

export class AuthError extends Error {
  constructor(public readonly code: "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "INVALID_REFRESH_TOKEN") {
    super(code);
  }
}

export type AuthResult = { token: string; refreshToken: string; user: PublicUser };

export async function login(email: string, password: string, remember: boolean): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !user.password_hash || !valid) throw new AuthError("INVALID_CREDENTIALS");

  const { id, username, display_name, avatar_url, avatar_seed } = user;
  return createSession({ id, username, display_name, avatar_url, avatar_seed }, remember);
}

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  if (await findUserByEmail(email)) throw new AuthError("EMAIL_TAKEN");

  const user = await createUser({
    email,
    username: makeUsername(name),
    display_name: name,
    password_hash: await bcrypt.hash(password, SALT_ROUNDS),
  });

  return createSession(user, false);
}

// Échange un refresh token contre une nouvelle paire (rotation : l'ancien devient inutilisable).
export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  const stored = await findRefreshTokenByHash(hashToken(refreshToken));
  if (!stored || new Date(stored.expires_at) <= new Date()) throw new AuthError("INVALID_REFRESH_TOKEN");

  // Token déjà utilisé (ou deux refresh simultanés) : vol probable, toute la session est coupée.
  if (stored.revoked_at || !(await revokeRefreshToken(stored.id))) {
    await revokeRefreshTokenFamily(stored.family_id);
    throw new AuthError("INVALID_REFRESH_TOKEN");
  }

  const profile = await findProfileById(stored.user_id);
  if (!profile) throw new AuthError("INVALID_REFRESH_TOKEN");

  const { id, username, display_name, avatar_url, avatar_seed } = profile;
  const next = await issueRefreshToken(id, stored.family_id, new Date(stored.expires_at));
  return { token: await signToken(id, TOKEN_TTL), refreshToken: next, user: { id, username, display_name, avatar_url, avatar_seed } };
}

// Déconnexion : révoque toute la session (famille) du refresh token. Silencieux si token inconnu.
export async function logout(refreshToken: string) {
  const stored = await findRefreshTokenByHash(hashToken(refreshToken));
  if (stored) await revokeRefreshTokenFamily(stored.family_id);
}

async function createSession(user: PublicUser, remember: boolean): Promise<AuthResult> {
  const expiresAt = new Date(Date.now() + (remember ? REFRESH_TTL_REMEMBER_MS : REFRESH_TTL_SESSION_MS));
  const [token, refreshToken] = await Promise.all([
    signToken(user.id, TOKEN_TTL),
    issueRefreshToken(user.id, randomUUID(), expiresAt),
  ]);
  return { token, refreshToken, user };
}

// Token opaque aléatoire (256 bits) ; seule son empreinte SHA-256 est stockée en base.
async function issueRefreshToken(userId: string, familyId: string, expiresAt: Date) {
  const token = randomBytes(32).toString("base64url");
  await insertRefreshToken({ user_id: userId, family_id: familyId, token_hash: hashToken(token), expires_at: expiresAt });
  return token;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function makeUsername(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20) || "user";

  return `${base}_${randomBytes(3).toString("hex")}`;
}

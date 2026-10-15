import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { getConfig } from "@/lib/config";
import { signRefreshToken, signToken, verifyRefreshToken } from "@/lib/jwt";
import {
  findRefreshTokenByHash,
  insertRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
} from "@/lib/repositories/refresh-token.repository";
import {
  createUser,
  findProfileById,
  findUserAccess,
  findUserByEmail,
  type PublicUser,
} from "@/lib/repositories/user.repository";

// Email inconnu : comparaison avec un hash factice, même temps de réponse (pas d'énumération des comptes).
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), getConfig().bcryptSaltRounds);
  return dummyHash;
}

export class AuthError extends Error {
  constructor(public readonly code: "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "INVALID_REFRESH_TOKEN" | "ACCOUNT_BANNED") {
    super(code);
  }
}

// refreshExpiresAt : fin de vie de la session, reprise par la durée du cookie.
export type AuthResult = { token: string; refreshToken: string; refreshExpiresAt: Date; user: PublicUser };

export async function login(email: string, password: string, remember: boolean): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  const valid = await bcrypt.compare(password, user?.password_hash ?? (await getDummyHash()));

  if (!user || !user.password_hash || !valid) throw new AuthError("INVALID_CREDENTIALS");
  // Après le mot de passe : seul le titulaire apprend le bannissement.
  if (user.banned_at) throw new AuthError("ACCOUNT_BANNED");

  const { id, username, display_name, avatar_url, avatar_seed, avatar_background_color, role } = user;
  return createSession({ id, username, display_name, avatar_url, avatar_seed, avatar_background_color, role }, remember);
}

export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  if (await findUserByEmail(email)) throw new AuthError("EMAIL_TAKEN");

  const user = await createUser({
    email,
    username: makeUsername(name),
    display_name: name,
    password_hash: await bcrypt.hash(password, getConfig().bcryptSaltRounds),
  });

  return createSession(user, false);
}

// Rotation : l'ancien token devient inutilisable.
export async function refreshSession(refreshToken: string): Promise<AuthResult> {
  const userId = await verifyRefreshToken(refreshToken);
  if (!userId) throw new AuthError("INVALID_REFRESH_TOKEN");

  const stored = await findRefreshTokenByHash(hashToken(refreshToken));
  if (!stored || stored.user_id !== userId || new Date(stored.expires_at) <= new Date()) {
    throw new AuthError("INVALID_REFRESH_TOKEN");
  }

  // Token déjà utilisé : vol probable, toute la session est coupée.
  if (stored.revoked_at || !(await revokeRefreshToken(stored.id))) {
    await revokeRefreshTokenFamily(stored.family_id);
    throw new AuthError("INVALID_REFRESH_TOKEN");
  }

  const [profile, access] = await Promise.all([findProfileById(stored.user_id), findUserAccess(stored.user_id)]);
  if (!profile || !access || access.banned_at) {
    await revokeRefreshTokenFamily(stored.family_id);
    throw new AuthError("INVALID_REFRESH_TOKEN");
  }

  const { id, username, display_name, avatar_url, avatar_seed, avatar_background_color, role } = profile;
  const expiresAt = new Date(stored.expires_at);
  const next = await issueRefreshToken(id, stored.family_id, expiresAt);
  return {
    token: await signToken(id),
    refreshToken: next,
    refreshExpiresAt: expiresAt,
    user: { id, username, display_name, avatar_url, avatar_seed, avatar_background_color, role },
  };
}

export async function logout(refreshToken: string) {
  const stored = await findRefreshTokenByHash(hashToken(refreshToken));
  if (stored) await revokeRefreshTokenFamily(stored.family_id);
}

async function createSession(user: PublicUser, remember: boolean): Promise<AuthResult> {
  const { remember: rememberMs, session: sessionMs } = getConfig().refreshTokenTtlMs;
  const expiresAt = new Date(Date.now() + (remember ? rememberMs : sessionMs));
  const [token, refreshToken] = await Promise.all([
    signToken(user.id),
    issueRefreshToken(user.id, randomUUID(), expiresAt),
  ]);
  return { token, refreshToken, refreshExpiresAt: expiresAt, user };
}

// Seule l'empreinte SHA-256 est stockée en base.
async function issueRefreshToken(userId: string, familyId: string, expiresAt: Date) {
  const token = await signRefreshToken(userId, expiresAt);
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

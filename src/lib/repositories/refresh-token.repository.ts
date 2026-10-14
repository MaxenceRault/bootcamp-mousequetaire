import "server-only";
import { getDb } from "@/utils/db";

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: string;
  revoked_at: string | null;
};

type NewRefreshToken = {
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: Date;
};

export async function insertRefreshToken(token: NewRefreshToken) {
  const db = await getDb();
  await db.query(
    "insert into refresh_token (user_id, family_id, token_hash, expires_at) values ($1, $2, $3, $4)",
    [token.user_id, token.family_id, token.token_hash, token.expires_at],
  );
}

export async function findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
  const db = await getDb();
  const { rows } = await db.query<RefreshTokenRow>(
    "select id, user_id, family_id, expires_at, revoked_at from refresh_token where token_hash = $1",
    [tokenHash],
  );
  return rows[0] ?? null;
}

// Révoque un token encore actif. false si il était déjà révoqué (ex. deux refresh simultanés).
export async function revokeRefreshToken(id: string): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query(
    "update refresh_token set revoked_at = now() where id = $1 and revoked_at is null",
    [id],
  );
  return rowCount === 1;
}

export async function revokeRefreshTokenFamily(familyId: string) {
  const db = await getDb();
  await db.query("update refresh_token set revoked_at = now() where family_id = $1 and revoked_at is null", [
    familyId,
  ]);
}

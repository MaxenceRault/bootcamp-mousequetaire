import "server-only";
import { getDb } from "@/server/infra/db";

// Un seul lien valide à la fois : les précédents sont invalidés.
export async function replaceResetToken(userId: string, tokenHash: string, expiresAt: Date) {
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      "update password_reset_token set used_at = now() where user_id = $1 and used_at is null",
      [userId],
    );
    await client.query(
      "insert into password_reset_token (user_id, token_hash, expires_at) values ($1, $2, $3)",
      [userId, tokenHash, expiresAt],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Lien valide (non utilisé, non expiré, compte non banni) → nouveau mot de passe + lien consommé, dans une transaction.
// null : lien invalide. Sinon, l'id du compte (pour révoquer ses sessions).
export async function consumeResetTokenAndSetPassword(tokenHash: string, passwordHash: string): Promise<string | null> {
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    // Verrou : deux envois simultanés du même lien ne passent pas tous les deux.
    const { rows } = await client.query<{ id: number; user_id: string }>(
      `select t.id, t.user_id
       from password_reset_token t
       join users u on u.id = t.user_id
       where t.token_hash = $1 and t.used_at is null and t.expires_at > now() and u.banned_at is null
       for update of t`,
      [tokenHash],
    );
    const token = rows[0];
    if (!token) {
      await client.query("rollback");
      return null;
    }

    await client.query("update users set password_hash = $2 where id = $1", [token.user_id, passwordHash]);
    // Le lien utilisé et tout autre lien encore ouvert du compte deviennent inutilisables.
    await client.query(
      "update password_reset_token set used_at = now() where user_id = $1 and used_at is null",
      [token.user_id],
    );
    await client.query("commit");
    return token.user_id;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

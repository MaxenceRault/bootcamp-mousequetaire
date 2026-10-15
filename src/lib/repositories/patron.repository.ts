import "server-only";
import type { UserRole } from "@/lib/roles";
import { getDb } from "@/utils/db";

// Valeurs de l'enum user_role (colonne users.role, liste dans lib/roles.ts) utilisées ici.
export const PATRON_ROLE: UserRole = "patron";
// Rôle jamais remplacé par l'achat du rôle mécène (une seule colonne : l'admin perdrait ses droits).
export const ADMIN_ROLE: UserRole = "admin";

export type ConfirmedPayment = {
  stripe_session_id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
};

// Paiement confirmé par Stripe : enregistre le paiement ET attribue le rôle, dans une seule transaction
// (soit les deux, soit rien). Idempotent : un événement reçu deux fois ne change rien la seconde fois.
// false si le compte n'existe plus (ou est admin : son rôle n'est jamais remplacé).
export async function grantPatronRole(payment: ConfirmedPayment): Promise<boolean> {
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = await client.query("update users set role = $2 where id = $1 and role <> $3", [
      payment.user_id,
      PATRON_ROLE,
      ADMIN_ROLE,
    ]);
    if (user.rowCount === 0) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `insert into patron_payment (stripe_session_id, user_id, amount_cents, currency)
       values ($1, $2, $3, $4)
       on conflict (stripe_session_id) do nothing`,
      [payment.stripe_session_id, payment.user_id, payment.amount_cents, payment.currency],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

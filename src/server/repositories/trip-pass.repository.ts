import "server-only";
import { getDb } from "@/server/infra/db";

const ACTIVE = "refunded_at is null and revoked_at is null";

export type TripPassPurchase = {
  bmcPaymentId: number;
  // null : aucun compte Brb avec l'email du paiement.
  userId: string | null;
  amount: number;
  currency: string;
  // null : email absent du paiement.
  payerEmailHash: string | null;
  payerEmailHint: string | null;
};

export async function hasActiveTripPass(tripId: number): Promise<boolean> {
  const db = await getDb();
  const { rows } = await db.query(`select 1 from trip_pass where trip_id = $1 and ${ACTIVE} limit 1`, [tripId]);
  return rows.length > 0;
}

// Une commande par compte : choisir un autre voyage remplace la précédente. Consentements datés de maintenant.
export async function saveTripPassOrder(userId: string, tripId: number, salesTermsVersion: string) {
  const db = await getDb();
  await db.query(
    `insert into trip_pass_order (user_id, trip_id, sales_terms_version, withdrawal_waived_at) values ($1, $2, $3, now())
     on conflict (user_id) do update
       set trip_id = excluded.trip_id, sales_terms_version = excluded.sales_terms_version,
         withdrawal_waived_at = excluded.withdrawal_waived_at, created_at = now()`,
    [userId, tripId, salesTermsVersion],
  );
}

// Achat rattaché au voyage de la commande (moins de 24 h) du payeur ; sinon gardé « à rattacher » (trip_id null).
// null : achat déjà enregistré (webhook renvoyé).
export async function recordTripPassPurchase(purchase: TripPassPurchase): Promise<{ tripId: number | null } | null> {
  const db = await getDb();
  const client = await db.connect();
  try {
    await client.query("begin");
    const { rows: orders } = purchase.userId
      ? await client.query<{ trip_id: number; sales_terms_version: string; withdrawal_waived_at: string }>(
          `delete from trip_pass_order
           where user_id = $1 and created_at > now() - interval '24 hours'
           returning trip_id, sales_terms_version, withdrawal_waived_at`,
          [purchase.userId],
        )
      : { rows: [] };
    const order = orders[0];
    const tripId = order?.trip_id ?? null;

    // Consentements de la commande gardés avec l'achat (preuve).
    const inserted = await client.query(
      `insert into trip_pass (trip_id, user_id, bmc_payment_id, amount, currency, payer_email_hash, payer_email_hint,
         sales_terms_version, withdrawal_waived_at, assigned_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, case when $1::int is null then null else now() end)
       on conflict (bmc_payment_id) do nothing`,
      [
        tripId,
        purchase.userId,
        purchase.bmcPaymentId,
        purchase.amount,
        purchase.currency,
        purchase.payerEmailHash,
        purchase.payerEmailHint,
        order?.sales_terms_version ?? null,
        order?.withdrawal_waived_at ?? null,
      ],
    );
    // Déjà reçu : la commande n'est pas consommée une seconde fois.
    if (inserted.rowCount === 0) {
      await client.query("rollback");
      return null;
    }
    await client.query("commit");
    return { tripId };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// false : achat inconnu ou déjà remboursé.
export async function refundTripPass(bmcPaymentId: number): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query(
    "update trip_pass set refunded_at = now() where bmc_payment_id = $1 and refunded_at is null",
    [bmcPaymentId],
  );
  return rowCount === 1;
}

export type UnassignedTripPassRow = {
  id: number;
  amount: string;
  currency: string;
  payer_email_hint: string | null;
  created_at: string;
  // Compte Brb de même email, s'il existe.
  payer: { username: string } | null;
};

export async function findUnassignedTripPasses(): Promise<UnassignedTripPassRow[]> {
  const db = await getDb();
  const { rows } = await db.query<UnassignedTripPassRow>(
    `select p.id, p.amount, p.currency, p.payer_email_hint, p.created_at,
       case when u.id is null then null else json_build_object('username', u.username) end as payer
     from trip_pass p left join users u on u.id = p.user_id
     where p.trip_id is null and p.refunded_at is null and p.revoked_at is null
     order by p.created_at`,
  );
  return rows;
}

export type TripPassRow = {
  id: number;
  trip: { id: number; title: string; owner: string };
  gift: boolean;
  assigned_at: string;
};

export async function findActiveTripPasses(limit: number): Promise<TripPassRow[]> {
  const db = await getDb();
  const { rows } = await db.query<TripPassRow>(
    `select p.id, json_build_object('id', t.id, 'title', t.title, 'owner', o.username) as trip,
       p.bmc_payment_id is null as gift, p.assigned_at
     from trip_pass p join trip t on t.id = p.trip_id join users o on o.id = t.user_id
     where p.refunded_at is null and p.revoked_at is null
     order by p.assigned_at desc
     limit $1`,
    [limit],
  );
  return rows;
}

// Empreinte de l'email du paiement : comparée à l'adresse déclarée par l'acheteur avant de rattacher.
export async function findUnassignedTripPassEmailHash(id: number): Promise<{ payer_email_hash: string | null } | null> {
  const db = await getDb();
  const { rows } = await db.query<{ payer_email_hash: string | null }>(
    `select payer_email_hash from trip_pass where id = $1 and trip_id is null and ${ACTIVE}`,
    [id],
  );
  return rows[0] ?? null;
}

// false : achat introuvable, déjà rattaché, remboursé ou retiré.
export async function assignTripPass(id: number, tripId: number, adminId: string): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query(
    `update trip_pass set trip_id = $2, granted_by = $3, assigned_at = now()
     where id = $1 and trip_id is null and ${ACTIVE}`,
    [id, tripId, adminId],
  );
  return rowCount === 1;
}

export async function insertGiftTripPass(tripId: number, adminId: string): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    "insert into trip_pass (trip_id, granted_by, assigned_at) values ($1, $2, now()) returning id",
    [tripId, adminId],
  );
  return rows[0].id;
}

// null : pass introuvable ou déjà inactif.
export async function revokeTripPass(id: number): Promise<{ trip_id: number | null } | null> {
  const db = await getDb();
  const { rows } = await db.query<{ trip_id: number | null }>(
    `update trip_pass set revoked_at = now() where id = $1 and ${ACTIVE} returning trip_id`,
    [id],
  );
  return rows[0] ?? null;
}

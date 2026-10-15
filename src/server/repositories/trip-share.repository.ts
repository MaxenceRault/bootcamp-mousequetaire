import "server-only";
import { getDb } from "@/server/infra/db";
import type { TripAccessRole, TripMemberRole } from "@/schemas/trip-share.schema";

export type TripMemberRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_background_color: string | null;
  role: TripAccessRole;
};

export type TripInvitationRow = {
  id: number;
  role: TripMemberRole;
  // Par pseudo : l'invité ; par lien : null.
  invitee: { username: string; display_name: string } | null;
  expires_at: string;
  created_at: string;
};

export type PendingInvitationRow = {
  id: number;
  role: TripMemberRole;
  trip: { id: number; title: string; destination_country_code: string; destination_city: string | null; start_date: string; end_date: string };
  invited_by: string | null;
  expires_at: string;
};

const USER_COLUMNS = "u.id as user_id, u.username, u.display_name, u.avatar_url, u.avatar_seed, u.avatar_background_color";

// null : l'utilisateur n'a pas accès au voyage (ou il n'existe pas).
export async function findTripRole(tripId: number, userId: string): Promise<TripAccessRole | null> {
  const db = await getDb();
  const { rows } = await db.query<{ role: TripAccessRole | null }>(
    `select case when t.user_id = $2 then 'owner' else m.role::text end as role
     from trip t left join trip_member m on m.trip_id = t.id and m.user_id = $2
     where t.id = $1`,
    [tripId, userId],
  );
  return rows[0]?.role ?? null;
}

// Propriétaire en premier, puis membres par date d'arrivée.
export async function findTripMembers(tripId: number): Promise<TripMemberRow[]> {
  const db = await getDb();
  const { rows } = await db.query<TripMemberRow>(
    `select ${USER_COLUMNS}, 'owner' as role
     from trip t join users u on u.id = t.user_id where t.id = $1
     union all
     (select ${USER_COLUMNS}, m.role::text
      from trip_member m join users u on u.id = m.user_id
      where m.trip_id = $1 order by m.added_at)`,
    [tripId],
  );
  return rows;
}

export async function findActiveUserIdByUsername(username: string): Promise<string | null> {
  const db = await getDb();
  const { rows } = await db.query<{ id: string }>("select id from users where username = $1 and banned_at is null", [username]);
  return rows[0]?.id ?? null;
}

export async function updateMemberRole(tripId: number, userId: string, role: TripMemberRole): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("update trip_member set role = $3 where trip_id = $1 and user_id = $2", [tripId, userId, role]);
  return rowCount === 1;
}

export async function deleteMember(tripId: number, userId: string): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("delete from trip_member where trip_id = $1 and user_id = $2", [tripId, userId]);
  return rowCount === 1;
}

// Invitation par pseudo : remplace une invitation en attente pour la même personne. false si déjà membre.
export async function upsertUserInvitation(
  tripId: number,
  inviteeId: string,
  role: TripMemberRole,
  createdBy: string,
  expiresAt: Date,
): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query(
    `insert into trip_invitation (trip_id, role, invitee_id, created_by, expires_at)
     select $1, $3, $2, $4, $5
     where not exists (select 1 from trip_member where trip_id = $1 and user_id = $2)
     on conflict (trip_id, invitee_id) do update set role = excluded.role, created_by = excluded.created_by,
       expires_at = excluded.expires_at, created_at = now()`,
    [tripId, inviteeId, role, createdBy, expiresAt],
  );
  return rowCount === 1;
}

export async function insertLinkInvitation(
  tripId: number,
  tokenHash: string,
  role: TripMemberRole,
  createdBy: string,
  expiresAt: Date,
): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `insert into trip_invitation (trip_id, role, token_hash, created_by, expires_at)
     values ($1, $3, $2, $4, $5) returning id`,
    [tripId, tokenHash, role, createdBy, expiresAt],
  );
  return rows[0].id;
}

// Invitations encore valides d'un voyage (vue du propriétaire).
export async function findTripInvitations(tripId: number): Promise<TripInvitationRow[]> {
  const db = await getDb();
  const { rows } = await db.query<TripInvitationRow>(
    `select i.id, i.role, i.expires_at, i.created_at,
       case when u.id is null then null else json_build_object('username', u.username, 'display_name', u.display_name) end as invitee
     from trip_invitation i left join users u on u.id = i.invitee_id
     where i.trip_id = $1 and i.expires_at > now()
     order by i.created_at desc`,
    [tripId],
  );
  return rows;
}

export async function deleteTripInvitation(tripId: number, invitationId: number): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("delete from trip_invitation where id = $1 and trip_id = $2", [invitationId, tripId]);
  return rowCount === 1;
}

// Invitations reçues par pseudo, encore valides.
export async function findPendingInvitations(userId: string): Promise<PendingInvitationRow[]> {
  const db = await getDb();
  const { rows } = await db.query<PendingInvitationRow>(
    `select i.id, i.role, i.expires_at,
       json_build_object('id', t.id, 'title', t.title, 'destination_country_code', t.destination_country_code,
         'destination_city', t.destination_city, 'start_date', to_char(t.start_date, 'YYYY-MM-DD'),
         'end_date', to_char(t.end_date, 'YYYY-MM-DD')) as trip,
       inviter.display_name as invited_by
     from trip_invitation i
     join trip t on t.id = i.trip_id
     left join users inviter on inviter.id = i.created_by
     where i.invitee_id = $1 and i.expires_at > now()
     order by i.created_at desc`,
    [userId],
  );
  return rows;
}

// Accepte (crée le membre) ou refuse une invitation par pseudo ; renvoie l'id du voyage, null si introuvable ou expirée.
export async function answerUserInvitation(invitationId: number, userId: string, accepted: boolean): Promise<number | null> {
  const client = await (await getDb()).connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ trip_id: number; role: TripMemberRole }>(
      `delete from trip_invitation where id = $1 and invitee_id = $2 and expires_at > now() returning trip_id, role`,
      [invitationId, userId],
    );
    const invitation = rows[0];
    if (invitation && accepted) await addMember(client, invitation.trip_id, userId, invitation.role);
    await client.query("commit");
    return invitation?.trip_id ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// Lien d'invitation : réutilisable jusqu'à expiration. Le propriétaire et les membres existants gardent leur rôle.
export async function joinWithLink(tokenHash: string, userId: string): Promise<number | null> {
  const client = await (await getDb()).connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<{ trip_id: number; role: TripMemberRole; owner_id: string }>(
      `select i.trip_id, i.role, t.user_id as owner_id
       from trip_invitation i join trip t on t.id = i.trip_id
       where i.token_hash = $1 and i.expires_at > now()`,
      [tokenHash],
    );
    const invitation = rows[0];
    if (invitation && invitation.owner_id !== userId) await addMember(client, invitation.trip_id, userId, invitation.role);
    await client.query("commit");
    return invitation?.trip_id ?? null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function addMember(
  client: { query: (text: string, values: unknown[]) => Promise<unknown> },
  tripId: number,
  userId: string,
  role: TripMemberRole,
) {
  await client.query(
    `insert into trip_member (trip_id, user_id, role) values ($1, $2, $3) on conflict (trip_id, user_id) do nothing`,
    [tripId, userId, role],
  );
  // Une invitation par pseudo en attente devient inutile.
  await client.query("delete from trip_invitation where trip_id = $1 and invitee_id = $2", [tripId, userId]);
}

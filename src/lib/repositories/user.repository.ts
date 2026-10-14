import "server-only";
import { DatabaseError } from "pg";
import { getDb } from "@/utils/db";

export type PublicUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_seed: string | null;
};

export type UserWithPassword = PublicUser & { password_hash: string | null };

type NewUser = {
  email: string;
  username: string;
  display_name: string;
  password_hash: string;
};

// Profil complet renvoyé par la page profil (jamais d'email ni de hash).
export type ProfileUser = PublicUser & { location: string | null; created_at: string };

type ProfileChanges = Pick<ProfileUser, "username" | "display_name" | "location" | "avatar_seed">;

// Le pseudo demandé appartient déjà à un autre utilisateur (contrainte unique en base).
export class UsernameTakenError extends Error {
  constructor() {
    super("username_taken");
  }
}

const PUBLIC_COLUMNS = "id, username, display_name, avatar_url, avatar_seed";
const PROFILE_COLUMNS = `${PUBLIC_COLUMNS}, location, created_at`;
// Code Postgres d'une violation de contrainte unique.
const UNIQUE_VIOLATION = "23505";

export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const db = await getDb();
  const { rows } = await db.query<UserWithPassword>(
    `select ${PUBLIC_COLUMNS}, password_hash from users where email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function createUser(user: NewUser): Promise<PublicUser> {
  const db = await getDb();
  const { rows } = await db.query<PublicUser>(
    `insert into users (email, username, display_name, password_hash)
     values ($1, $2, $3, $4)
     returning ${PUBLIC_COLUMNS}`,
    [user.email, user.username, user.display_name, user.password_hash],
  );
  return rows[0];
}

export async function findProfileById(id: string): Promise<ProfileUser | null> {
  const db = await getDb();
  const { rows } = await db.query<ProfileUser>(`select ${PROFILE_COLUMNS} from users where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updateProfile(id: string, changes: ProfileChanges): Promise<ProfileUser | null> {
  const db = await getDb();
  try {
    const { rows } = await db.query<ProfileUser>(
      `update users set username = $2, display_name = $3, location = $4, avatar_seed = $5
       where id = $1
       returning ${PROFILE_COLUMNS}`,
      [id, changes.username, changes.display_name, changes.location, changes.avatar_seed],
    );
    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof DatabaseError && error.code === UNIQUE_VIOLATION) throw new UsernameTakenError();
    throw error;
  }
}

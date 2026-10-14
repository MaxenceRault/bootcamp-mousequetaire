import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

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
  const { data, error } = await createAdminClient()
    .from("users")
    .select(`${PUBLIC_COLUMNS}, password_hash`)
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data as UserWithPassword | null;
}

export async function createUser(user: NewUser): Promise<PublicUser> {
  const { data, error } = await createAdminClient()
    .from("users")
    .insert(user)
    .select(PUBLIC_COLUMNS)
    .single();

  if (error) throw error;
  return data as PublicUser;
}

export async function findProfileById(id: string): Promise<ProfileUser | null> {
  const { data, error } = await createAdminClient()
    .from("users")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as ProfileUser | null;
}

export async function updateProfile(id: string, changes: ProfileChanges): Promise<ProfileUser | null> {
  const { data, error } = await createAdminClient()
    .from("users")
    .update(changes)
    .eq("id", id)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error?.code === UNIQUE_VIOLATION) throw new UsernameTakenError();
  if (error) throw error;
  return data as ProfileUser | null;
}

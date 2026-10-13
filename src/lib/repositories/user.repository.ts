import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

export type PublicUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type UserWithPassword = PublicUser & { password_hash: string | null };

type NewUser = {
  email: string;
  username: string;
  display_name: string;
  password_hash: string;
};

const PUBLIC_COLUMNS = "id, username, display_name, avatar_url";

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

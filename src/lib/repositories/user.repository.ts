import "server-only";
import { DatabaseError } from "pg";
import { PHOTO_BUCKET } from "@/lib/repositories/post.repository";
import { getDb } from "@/utils/db";
import { getBucket, publicUrl } from "@/utils/storage";

export type PublicUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_background_color: string | null;
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

type ProfileChanges = Pick<ProfileUser, "username" | "display_name" | "location" | "avatar_seed" | "avatar_background_color">;

// Le pseudo demandé appartient déjà à un autre utilisateur (contrainte unique en base).
export class UsernameTakenError extends Error {
  constructor() {
    super("username_taken");
  }
}

const PUBLIC_COLUMNS = "id, username, display_name, avatar_url, avatar_seed, avatar_background_color";
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
      `update users set username = $2, display_name = $3, location = $4, avatar_seed = $5, avatar_background_color = $6
       where id = $1
       returning ${PROFILE_COLUMNS}`,
      [id, changes.username, changes.display_name, changes.location, changes.avatar_seed, changes.avatar_background_color],
    );
    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof DatabaseError && error.code === UNIQUE_VIOLATION) throw new UsernameTakenError();
    throw error;
  }
}

// Photo de profil (remplace le blobatar), stockée dans le bucket (dossier avatars/<id utilisateur>/).
const AVATAR_FOLDER = "avatars";

export async function findAvatarUrl(id: string): Promise<string | null> {
  const db = await getDb();
  const { rows } = await db.query<{ avatar_url: string | null }>("select avatar_url from users where id = $1", [id]);
  return rows[0]?.avatar_url ?? null;
}

// null : retire la photo. Renvoie le profil à jour (null si le compte n'existe plus).
export async function setAvatarUrl(id: string, url: string | null): Promise<ProfileUser | null> {
  const db = await getDb();
  const { rows } = await db.query<ProfileUser>(
    `update users set avatar_url = $2 where id = $1 returning ${PROFILE_COLUMNS}`,
    [id, url],
  );
  return rows[0] ?? null;
}

// Chemin généré côté serveur : jamais le nom de fichier envoyé par le client.
export async function uploadAvatar(userId: string, fileName: string, image: File, contentType: string): Promise<string> {
  const path = `${AVATAR_FOLDER}/${userId}/${fileName}`;
  await getBucket(PHOTO_BUCKET)
    .file(path)
    .save(Buffer.from(await image.arrayBuffer()), {
      contentType,
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
    });
  return publicUrl(PHOTO_BUCKET, path);
}

// Supprime une photo de profil du bucket (ignorée si l'URL n'est pas dans le dossier de l'utilisateur).
export async function deleteAvatar(userId: string, url: string) {
  const prefix = publicUrl(PHOTO_BUCKET, `${AVATAR_FOLDER}/${userId}/`);
  if (!url.startsWith(prefix)) return;
  await getBucket(PHOTO_BUCKET).file(decodeURIComponent(url.slice(publicUrl(PHOTO_BUCKET, "").length))).delete();
}

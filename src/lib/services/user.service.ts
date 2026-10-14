import "server-only";
import { randomUUID } from "node:crypto";
import { detectImage } from "@/lib/images";
import {
  findPostsByAuthor,
  findSavedPostsByUser,
  type PostSummary,
  type PostSummaryWithAuthor,
} from "@/lib/repositories/post.repository";
import {
  deleteAvatar,
  findAvatarUrl,
  findProfileById,
  setAvatarUrl,
  updateProfile,
  uploadAvatar,
  UsernameTakenError,
  type ProfileUser,
} from "@/lib/repositories/user.repository";
import type { UpdateProfileInput } from "@/schemas/user.schema";

export class ProfileError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "USERNAME_TAKEN" | "INVALID_INPUT") {
    super(code);
  }
}

export type MyProfile = {
  user: ProfileUser;
  stories: PostSummary[];
  storyCount: number;
  // Voyages enregistrés (posts d'autres auteurs ou les siens), du dernier enregistré au premier.
  saved: PostSummaryWithAuthor[];
};

const STORIES_LIMIT = 12;
const SAVED_LIMIT = 48;

// Profil de l'utilisateur connecté + ses récits publiés.
export async function getMyProfile(userId: string): Promise<MyProfile> {
  const [user, { posts, total }, saved] = await Promise.all([
    findProfileById(userId),
    findPostsByAuthor(userId, STORIES_LIMIT),
    findSavedPostsByUser(userId, SAVED_LIMIT),
  ]);

  // Token valide mais compte supprimé entre-temps.
  if (!user) throw new ProfileError("NOT_FOUND");
  return { user, stories: posts, storyCount: total, saved };
}

// L'utilisateur ne peut modifier que son propre profil : l'id vient du token, jamais du body.
export async function updateMyProfile(userId: string, input: UpdateProfileInput): Promise<ProfileUser> {
  try {
    const user = await updateProfile(userId, input);
    if (!user) throw new ProfileError("NOT_FOUND");
    return user;
  } catch (error) {
    if (error instanceof UsernameTakenError) throw new ProfileError("USERNAME_TAKEN");
    throw error;
  }
}

// Photo de profil. image null : retire la photo (retour au blobatar).
// L'ancienne photo est supprimée du bucket une fois la nouvelle enregistrée.
export async function setMyAvatar(userId: string, image: File | null): Promise<ProfileUser> {
  const previous = await findAvatarUrl(userId);

  let url: string | null = null;
  if (image) {
    // Type réel lu dans le fichier : un fichier renommé en .png n'est pas accepté.
    const detected = await detectImage(image);
    if (!detected) throw new ProfileError("INVALID_INPUT");
    url = await uploadAvatar(userId, `${randomUUID()}.${detected.extension}`, image, detected.contentType);
  }

  let user: ProfileUser | null;
  try {
    user = await setAvatarUrl(userId, url);
  } catch (error) {
    // Base en échec : la nouvelle photo ne doit pas rester orpheline dans le bucket.
    if (url) await deleteAvatar(userId, url).catch(() => {});
    throw error;
  }
  if (!user) throw new ProfileError("NOT_FOUND");

  if (previous && previous !== url) await deleteAvatar(userId, previous).catch(() => {});
  return user;
}

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
  findProfileByUsername,
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
  saved: PostSummaryWithAuthor[];
};

const STORIES_LIMIT = 12;
const SAVED_LIMIT = 48;

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

// Identité affichée même sur un profil privé (jamais email, rôle interne ni réglages).
export type PublicIdentity = Pick<
  ProfileUser,
  "id" | "username" | "display_name" | "avatar_url" | "avatar_seed" | "avatar_background_color" | "role"
>;

// Récit d'une grille publique : sans les champs internes (is_hidden, pending_review).
export type PublicStory = Omit<PostSummary, "is_hidden" | "pending_review">;

export type PublicProfile =
  | { isPrivate: true; user: PublicIdentity }
  | {
      isPrivate: false;
      user: PublicIdentity & Pick<ProfileUser, "location" | "created_at">;
      stories: PublicStory[];
      storyCount: number;
      // null : l'utilisateur ne montre pas ses enregistrés.
      saved: PostSummaryWithAuthor[] | null;
    };

// Profil vu par un visiteur (/profile/{pseudo}). Les réglages de confidentialité sont appliqués ICI :
// ce qui est caché n'est jamais envoyé au navigateur. Jamais les itinéraires IA.
export async function getPublicProfile(username: string): Promise<PublicProfile> {
  const profile = await findProfileByUsername(username);
  if (!profile) throw new ProfileError("NOT_FOUND");

  const { id, display_name, avatar_url, avatar_seed, avatar_background_color, role } = profile;
  const identity: PublicIdentity = { id, username: profile.username, display_name, avatar_url, avatar_seed, avatar_background_color, role };
  if (profile.is_private) return { isPrivate: true, user: identity };

  const [{ posts, total }, saved] = await Promise.all([
    findPostsByAuthor(id, STORIES_LIMIT, { visibleOnly: true }),
    profile.show_saved ? findSavedPostsByUser(id, SAVED_LIMIT) : Promise.resolve(null),
  ]);

  return {
    isPrivate: false,
    user: { ...identity, location: profile.location, created_at: profile.created_at },
    stories: posts.map(toPublicStory),
    storyCount: total,
    saved,
  };
}

// Allowlist des champs d'un récit envoyés à un visiteur.
function toPublicStory(story: PostSummary): PublicStory {
  const { id, title, slug, photo_url, photo_alt, destination_country_code, destination_state_code, destination_city, start_date, created_at } = story;
  return { id, title, slug, photo_url, photo_alt, destination_country_code, destination_state_code, destination_city, start_date, created_at };
}

// L'id vient du token, jamais du body.
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

// null : retire la photo. L'ancienne est supprimée du bucket après coup.
export async function setMyAvatar(userId: string, image: File | null): Promise<ProfileUser> {
  const previous = await findAvatarUrl(userId);

  let url: string | null = null;
  if (image) {
    // Type réel lu dans le fichier, pas l'extension.
    const detected = await detectImage(image);
    if (!detected) throw new ProfileError("INVALID_INPUT");
    url = await uploadAvatar(userId, `${randomUUID()}.${detected.extension}`, image, detected.contentType);
  }

  let user: ProfileUser | null;
  try {
    user = await setAvatarUrl(userId, url);
  } catch (error) {
    // Base en échec : la nouvelle photo ne doit pas rester orpheline.
    if (url) await deleteAvatar(userId, url).catch(() => {});
    throw error;
  }
  if (!user) throw new ProfileError("NOT_FOUND");

  if (previous && previous !== url) await deleteAvatar(userId, previous).catch(() => {});
  return user;
}

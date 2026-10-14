import "server-only";
import { findPostsByAuthor, type PostSummary } from "@/lib/repositories/post.repository";
import {
  findProfileById,
  updateProfile,
  UsernameTakenError,
  type ProfileUser,
} from "@/lib/repositories/user.repository";
import type { UpdateProfileInput } from "@/schemas/user.schema";

export class ProfileError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "USERNAME_TAKEN") {
    super(code);
  }
}

export type MyProfile = {
  user: ProfileUser;
  stories: PostSummary[];
  storyCount: number;
};

const STORIES_LIMIT = 12;

// Profil de l'utilisateur connecté + ses récits publiés.
export async function getMyProfile(userId: string): Promise<MyProfile> {
  const [user, { posts, total }] = await Promise.all([
    findProfileById(userId),
    findPostsByAuthor(userId, STORIES_LIMIT),
  ]);

  // Token valide mais compte supprimé entre-temps.
  if (!user) throw new ProfileError("NOT_FOUND");
  return { user, stories: posts, storyCount: total };
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

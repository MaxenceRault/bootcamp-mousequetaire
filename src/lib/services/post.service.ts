import "server-only";
import { detectImage } from "@/lib/images";
import { randomUUID } from "node:crypto";
import type { Archetype, FeedPage, FeedPost } from "@/lib/posts";
import type { UserRole } from "@/lib/roles";
import { findSelectableArchetype } from "@/lib/services/archetype.service";
import { moderatePost, type ModerationReason } from "@/lib/services/moderation.service";
import { insertSystemReport } from "@/lib/repositories/report.repository";
import {
  deleteAuthorPost,
  deletePost,
  deletePostPhoto,
  findFeedPosts,
  findPostOwnership,
  findPostDetail,
  findRandomCoverPhotos,
  findPostSlugById,
  findPostIdsByPlace,
  findPostSummariesByIds,
  insertPost,
  insertPostTags,
  photoPathFromUrl,
  updatePostVisibility,
  uploadPostPhoto,
  upsertTags,
  type FeedPostRow,
  type PlaceFilter,
  type PostSummaryWithAuthor,
  searchFeedPosts,
} from "@/lib/repositories/post.repository";
import type { CreatePostInput, PlaceInput } from "@/schemas/post.schema";
import { describePlace, placeExists, searchPlaces, type PlaceNames } from "@/lib/services/location.service";

export const FEED_PAGE_SIZE = 10;

export class PostError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONTENT_REJECTED" | "PENDING_REVIEW",
    public readonly reasons: ModerationReason[] = [],
  ) {
    super(code);
  }
}

// Deux posts du même titre au même instant : même slug calculé.
const SLUG_ATTEMPTS = 3;

// pendingReview : IA de modération indisponible, publié masqué jusqu'à validation par un admin.
export async function createPost(
  authorId: string,
  input: CreatePostInput,
): Promise<{ id: number; slug: string; pendingReview: boolean }> {
  const destination = { country: input.destinationCountry, state: input.destinationState, city: input.destinationCity };
  const tags = uniquePlaces(input.tags);

  if (![destination, ...tags].every(placeExists)) throw new PostError("INVALID_INPUT");

  const image = await detectImage(input.photo);
  if (!image) throw new PostError("INVALID_INPUT");

  const archetype = await findSelectableArchetype(input.archetype);
  if (!archetype) throw new PostError("INVALID_INPUT");

  // Vérifié avant tout enregistrement : un contenu refusé n'atteint ni le bucket ni la base.
  const moderation = await moderatePost({
    title: input.title,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    photoAlt: input.photoAlt,
    photo: input.photo,
    photoType: image.contentType,
  });
  if (moderation.status === "rejected") throw new PostError("CONTENT_REJECTED", moderation.reasons);
  const pendingReview = moderation.status === "unavailable";

  // Jamais le nom de fichier envoyé par le client.
  const photoPath = `${authorId}/${randomUUID()}.${image.extension}`;
  const photoUrl = await uploadPostPhoto(photoPath, input.photo, image.contentType);

  // Bucket et base ne partagent pas de transaction : on défait ce qui a été créé.
  try {
    const fields = {
      author_id: authorId,
      title: input.title,
      photo_url: photoUrl,
      photo_alt: input.photoAlt,
      short_description: input.shortDescription,
      long_description: input.longDescription,
      destination_country_code: destination.country,
      destination_state_code: destination.state ?? null,
      destination_city: destination.city ?? null,
      start_date: input.startDate,
      end_date: input.endDate,
      archetype_id: archetype.id,
      is_hidden: pendingReview,
      pending_review: pendingReview,
    };

    let created: { id: number; slug: string } | null = null;
    for (let attempt = 0; attempt < SLUG_ATTEMPTS && !created; attempt++) {
      created = await insertPost(fields);
    }
    if (!created) throw new Error("slug libre introuvable");
    const postId = created.id;

    try {
      if (tags.length > 0) {
        const tagIds = await upsertTags(
          tags.map(({ country, state, city }) => ({ country_code: country, state_code: state ?? null, city: city ?? null })),
        );
        await insertPostTags(postId, tagIds);
      }
      if (pendingReview) await insertSystemReport(postId, "Modération automatique indisponible : à vérifier avant publication.");
    } catch (error) {
      await deletePost(postId).catch(() => {});
      throw error;
    }

    return { ...created, pendingReview };
  } catch (error) {
    await deletePostPhoto(photoPath).catch(() => {});
    throw error;
  }
}

function uniquePlaces(places: PlaceInput[]) {
  const seen = new Set<string>();
  return places.filter(({ country, state, city }) => {
    const key = JSON.stringify([country, state ?? null, city ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getFeedPage({
  archetype,
  cursor,
  limit = FEED_PAGE_SIZE,
}: {
  archetype?: string;
  cursor?: number;
  limit?: number;
}): Promise<FeedPage> {
  // Un post de plus que demandé : s'il existe, il y a une suite.
  const rows = await findFeedPosts({ archetype, beforeId: cursor, limit: limit + 1 });
  const page = rows.slice(0, limit);

  return {
    posts: page.map(toFeedPost),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

function toFeedPost(row: FeedPostRow): FeedPost {
  const { destination_country_code: country, destination_state_code: state, destination_city: city } = row;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    location: city ?? describePlace({ country, state }).state,
    countryCode: country,
    archetype: row.archetype,
    photoUrl: row.photo_url,
    photoAlt: row.photo_alt,
    createdAt: new Date(row.created_at),
    likeCount: row.like_count,
    author: {
      id: row.author.id,
      username: row.author.username,
      displayName: row.author.display_name,
      avatarUrl: row.author.avatar_url,
      avatarSeed: row.author.avatar_seed,
      avatarBackgroundColor: row.author.avatar_background_color,
    },
  };
}

// Post d'un autre auteur : même erreur que s'il n'existait pas.
async function requireOwnPost(postId: number, userId: string) {
  const post = await findPostOwnership(postId);
  if (!post || post.author_id !== userId) throw new PostError("NOT_FOUND");
  return post;
}

export async function setPostHidden(userId: string, postId: number, hidden: boolean) {
  const post = await requireOwnPost(postId, userId);
  // En attente de modération : seul un admin peut le publier.
  if (!hidden && post.pending_review) throw new PostError("PENDING_REVIEW");
  if (!(await updatePostVisibility(postId, userId, hidden))) throw new PostError("NOT_FOUND");
  return { id: postId, hidden };
}

export async function deleteOwnPost(userId: string, postId: number) {
  const post = await requireOwnPost(postId, userId);
  if (!(await deleteAuthorPost(postId, userId))) throw new PostError("NOT_FOUND");

  // Le post est supprimé : un échec sur la photo ne doit pas faire échouer la requête.
  const photoPath = photoPathFromUrl(post.photo_url);
  if (photoPath) await deletePostPhoto(photoPath).catch(() => {});
}

export type PostDetail = {
  id: number;
  title: string;
  slug: string;
  photoUrl: string;
  photoAlt: string;
  shortDescription: string;
  // Affiché en texte brut, jamais en HTML.
  paragraphs: string[];
  destination: PlaceNames & { countryCode: string; stateCode: string | null };
  startDate: string;
  endDate: string;
  durationDays: number;
  readingMinutes: number;
  createdAt: string;
  archetype: Archetype;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; avatarSeed: string | null; avatarBackgroundColor: string | null; role: UserRole };
  tags: { label: string; countryCode: string; stateCode: string | null; city: string | null }[];
};

const WORDS_PER_MINUTE = 200;
const DAY_MS = 86_400_000;

export async function getPostDetail(slug: string): Promise<PostDetail | null> {
  const row = await findPostDetail({ slug });
  if (!row) return null;

  const words = `${row.short_description} ${row.long_description}`.split(/\s+/).filter(Boolean).length;
  const destination = describePlace({
    country: row.destination_country_code,
    state: row.destination_state_code,
    city: row.destination_city,
  });

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    photoUrl: row.photo_url,
    photoAlt: row.photo_alt,
    shortDescription: row.short_description,
    paragraphs: row.long_description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    destination: { ...destination, countryCode: row.destination_country_code, stateCode: row.destination_state_code },
    startDate: row.start_date,
    endDate: row.end_date,
    // Dates incluses : du 14 au 18 = 5 jours.
    durationDays: Math.round((Date.parse(row.end_date) - Date.parse(row.start_date)) / DAY_MS) + 1,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    createdAt: row.created_at,
    archetype: row.archetype,
    author: {
      id: row.author.id,
      username: row.author.username,
      displayName: row.author.display_name,
      avatarUrl: row.author.avatar_url,
      avatarSeed: row.author.avatar_seed,
      avatarBackgroundColor: row.author.avatar_background_color,
      role: row.author.role,
    },
    tags: row.post_tag.map(({ tag }) => {
      const names = describePlace({ country: tag.country_code, state: tag.state_code, city: tag.city });
      return {
        label: names.city ?? names.state ?? names.country,
        countryCode: tag.country_code,
        stateCode: tag.state_code,
        city: tag.city,
      };
    }),
  };
}

const PLACE_POSTS_LIMIT = 48;

export type PlacePosts = { place: PlaceNames; posts: PostSummaryWithAuthor[] };

export async function getPostsByPlace(place: PlaceFilter): Promise<PlacePosts | null> {
  if (!placeExists(place)) return null;

  const ids = await findPostIdsByPlace(place);
  return {
    place: describePlace(place),
    posts: await findPostSummariesByIds(ids, PLACE_POSTS_LIMIT),
  };
}

const SEARCH_LIMIT = 30;

// Les lieux viennent de country-state-city : « Japon » trouve les posts du Japon même sans le mot.
export async function searchPosts(query: string): Promise<FeedPost[]> {
  const places = searchPlaces(query).map(({ country, state, city }) => ({
    country,
    state: state ?? null,
    city: city ?? null,
  }));
  const rows = await searchFeedPosts({ text: query, places, limit: SEARCH_LIMIT });
  return rows.map(toFeedPost);
}

export function getPostSlug(id: number): Promise<string | null> {
  return findPostSlugById(id);
}

const HERO_PHOTOS = 6;

export function getHeroPhotos() {
  return findRandomCoverPhotos(HERO_PHOTOS);
}

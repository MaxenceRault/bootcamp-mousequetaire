import "server-only";
import { randomUUID } from "node:crypto";
import { POST_ARCHETYPES, type FeedPage, type FeedPost, type PostArchetype } from "@/lib/posts";
import {
  deleteAuthorPost,
  deletePost,
  deletePostPhoto,
  findArchetypeIdBySlug,
  findFeedPosts,
  findPostOwnership,
  findPostById,
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
} from "@/lib/repositories/post.repository";
import type { CreatePostInput, PlaceInput } from "@/schemas/post.schema";
import { describePlace, placeExists, type PlaceNames } from "@/lib/services/location.service";

// Nombre de posts chargés à la fois dans le feed (première page puis chaque « suite »).
export const FEED_PAGE_SIZE = 10;

export class PostError extends Error {
  constructor(public readonly code: "INVALID_INPUT" | "NOT_FOUND") {
    super(code);
  }
}

// Type réel de l'image, lu dans ses premiers octets (le type annoncé par le navigateur ne prouve rien).
const IMAGE_SIGNATURES = [
  { extension: "jpg", contentType: "image/jpeg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    extension: "png",
    contentType: "image/png",
    matches: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte),
  },
  {
    extension: "webp",
    contentType: "image/webp",
    // « RIFF » (octets 0-3) … « WEBP » (octets 8-11)
    matches: (b: Uint8Array) =>
      [0x52, 0x49, 0x46, 0x46].every((byte, i) => b[i] === byte) &&
      [0x57, 0x45, 0x42, 0x50].every((byte, i) => b[i + 8] === byte),
  },
];

export async function createPost(authorId: string, input: CreatePostInput): Promise<{ id: number }> {
  const destination = { country: input.destinationCountry, state: input.destinationState, city: input.destinationCity };
  const tags = uniquePlaces(input.tags);

  // Lieux inventés ou incohérents (ville hors de sa région…) refusés.
  if (![destination, ...tags].every(placeExists)) throw new PostError("INVALID_INPUT");

  const image = await detectImage(input.photo);
  if (!image) throw new PostError("INVALID_INPUT");

  const archetypeId = await findArchetypeIdBySlug(input.archetype);
  if (!archetypeId) throw new PostError("INVALID_INPUT");

  // Nom de fichier généré côté serveur : jamais le nom envoyé par le client.
  const photoPath = `${authorId}/${randomUUID()}.${image.extension}`;
  const photoUrl = await uploadPostPhoto(photoPath, input.photo, image.contentType);

  // Photo (Cloud Storage) et lignes en base ne peuvent pas partager une transaction : en cas d'échec, on défait ce qui a été créé.
  try {
    const postId = await insertPost({
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
      archetype_id: archetypeId,
    });

    try {
      if (tags.length > 0) {
        const tagIds = await upsertTags(
          tags.map(({ country, state, city }) => ({ country_code: country, state_code: state ?? null, city: city ?? null })),
        );
        await insertPostTags(postId, tagIds);
      }
    } catch (error) {
      await deletePost(postId).catch(() => {});
      throw error;
    }

    return { id: postId };
  } catch (error) {
    await deletePostPhoto(photoPath).catch(() => {});
    throw error;
  }
}

async function detectImage(photo: File) {
  const bytes = new Uint8Array(await photo.slice(0, 12).arrayBuffer());
  return IMAGE_SIGNATURES.find((signature) => signature.matches(bytes)) ?? null;
}

// Un même lieu envoyé deux fois ne compte qu'une fois.
function uniquePlaces(places: PlaceInput[]) {
  const seen = new Set<string>();
  return places.filter(({ country, state, city }) => {
    const key = JSON.stringify([country, state ?? null, city ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Une page du feed. cursor : id du dernier post déjà affiché (absent pour la première page).
export async function getFeedPage({
  archetype,
  cursor,
  limit = FEED_PAGE_SIZE,
}: {
  archetype?: PostArchetype;
  cursor?: number;
  limit?: number;
}): Promise<FeedPage> {
  // Un post de plus que demandé : s'il existe, il y a une suite à charger.
  const rows = await findFeedPosts({ archetype, beforeId: cursor, limit: limit + 1 });
  const page = rows.slice(0, limit);

  return {
    posts: page.flatMap(toFeedPost),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  };
}

function toFeedPost(row: FeedPostRow): FeedPost[] {
  const archetype = POST_ARCHETYPES.find((slug) => slug === row.archetype.slug);
  // Type de récit inconnu de l'app (ajouté en base sans mettre à jour POST_ARCHETYPES) : post ignoré.
  if (!archetype) return [];

  const { destination_country_code: country, destination_state_code: state, destination_city: city } = row;

  return [
    {
      id: row.id,
      title: row.title,
      shortDescription: row.short_description,
      // Ville, sinon nom de la région (describePlace) ; null pour un pays entier.
      location: city ?? describePlace({ country, state }).state,
      countryCode: country,
      archetype,
      photoUrl: row.photo_url,
      photoAlt: row.photo_alt,
      createdAt: new Date(row.created_at),
      author: {
        id: row.author.id,
        username: row.author.username,
        displayName: row.author.display_name,
        avatarUrl: row.author.avatar_url,
        avatarSeed: row.author.avatar_seed,
      },
    },
  ];
}

// Seul l'auteur peut modifier son post. Post inexistant ou d'un autre auteur : même erreur NOT_FOUND,
// pour ne pas révéler l'existence des posts des autres.
async function requireOwnPost(postId: number, userId: string) {
  const post = await findPostOwnership(postId);
  if (!post || post.author_id !== userId) throw new PostError("NOT_FOUND");
  return post;
}

// Masquer (hidden = true) ou réafficher un post : un post masqué disparaît du feed public.
export async function setPostHidden(userId: string, postId: number, hidden: boolean) {
  await requireOwnPost(postId, userId);
  if (!(await updatePostVisibility(postId, userId, hidden))) throw new PostError("NOT_FOUND");
  return { id: postId, hidden };
}

// Suppression définitive : le post, ses liens post_tag (cascade) et sa photo dans le bucket.
export async function deleteOwnPost(userId: string, postId: number) {
  const post = await requireOwnPost(postId, userId);
  if (!(await deleteAuthorPost(postId, userId))) throw new PostError("NOT_FOUND");

  // Le post est déjà supprimé : un échec sur la photo ne doit pas faire échouer la requête.
  const photoPath = photoPathFromUrl(post.photo_url);
  if (photoPath) await deletePostPhoto(photoPath).catch(() => {});
}

export type PostDetail = {
  id: number;
  title: string;
  photoUrl: string;
  photoAlt: string;
  shortDescription: string;
  // Texte long découpé en paragraphes (lignes vides) : affiché en texte brut, jamais en HTML.
  paragraphs: string[];
  destination: PlaceNames & { countryCode: string; stateCode: string | null };
  startDate: string;
  endDate: string;
  durationDays: number;
  readingMinutes: number;
  createdAt: string;
  archetype: string;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; avatarSeed: string | null };
  // Codes du lieu (liens vers /tags) + libellé affiché.
  tags: { label: string; countryCode: string; stateCode: string | null; city: string | null }[];
};

// Vitesse de lecture moyenne utilisée pour « X min de lecture ».
const WORDS_PER_MINUTE = 200;
const DAY_MS = 86_400_000;

// Post complet pour la page détail ; null s'il n'existe pas ou s'il est masqué par son auteur.
export async function getPostDetail(id: number): Promise<PostDetail | null> {
  const row = await findPostById(id);
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
    archetype: row.archetype.slug,
    author: {
      id: row.author.id,
      username: row.author.username,
      displayName: row.author.display_name,
      avatarUrl: row.author.avatar_url,
      avatarSeed: row.author.avatar_seed,
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

// Récits liés à un lieu (destination ou tag). null si le lieu n'existe pas dans country-state-city.
export async function getPostsByPlace(place: PlaceFilter): Promise<PlacePosts | null> {
  if (!placeExists(place)) return null;

  const ids = await findPostIdsByPlace(place);
  return {
    place: describePlace(place),
    posts: await findPostSummariesByIds(ids, PLACE_POSTS_LIMIT),
  };
}

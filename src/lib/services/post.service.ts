import "server-only";
import { randomUUID } from "node:crypto";
import {
  deletePost,
  deletePostPhoto,
  findArchetypeIdBySlug,
  insertPost,
  insertPostTags,
  uploadPostPhoto,
  upsertTags,
} from "@/lib/repositories/post.repository";
import type { CreatePostInput, PlaceInput } from "@/lib/schemas/post.schema";
import { placeExists } from "@/lib/services/location.service";

export class PostError extends Error {
  constructor(public readonly code: "INVALID_INPUT") {
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

  // Pas de transaction avec le client Supabase : en cas d'échec, on défait ce qui a été créé.
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

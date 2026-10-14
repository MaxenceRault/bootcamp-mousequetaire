import "server-only";
import { findActiveArchetypes, findArchetypeBySlug, type ArchetypeRow } from "@/lib/repositories/archetype.repository";
import type { Archetype } from "@/lib/posts";

export async function listActiveArchetypes(): Promise<Archetype[]> {
  return (await findActiveArchetypes()).map(({ slug, label }) => ({ slug, label }));
}

// Pour un nouveau récit ou voyage : doit exister et être actif.
export async function findSelectableArchetype(slug: string): Promise<ArchetypeRow | null> {
  const archetype = await findArchetypeBySlug(slug);
  return archetype?.is_active ? archetype : null;
}

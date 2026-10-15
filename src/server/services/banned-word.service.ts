import "server-only";
import type { BannedTerm } from "@/server/moderationFilter";
import { findBannedWords } from "@/server/repositories/banned-word.repository";

const CACHE_MS = 60_000;
let cache: { terms: BannedTerm[]; expiresAt: number } | null = null;

// Liste lue en base au plus une fois par minute (vidée dès qu'un admin la modifie).
export async function getBannedTerms(): Promise<BannedTerm[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.terms;
  const terms = (await findBannedWords()).map(({ term, reason, kind }) => ({ term, reason, kind }));
  cache = { terms, expiresAt: Date.now() + CACHE_MS };
  return terms;
}

export function clearBannedTermsCache() {
  cache = null;
}

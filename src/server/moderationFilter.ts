import "server-only";

// Modération du texte sans IA : recherche des termes bannis (table banned_word, gérée depuis l'admin).

export const BANNED_REASONS = ["insult", "hate", "sexual", "politics"] as const;
export type TextReason = (typeof BANNED_REASONS)[number];
export const BANNED_KINDS = ["word", "prefix", "phrase"] as const;

export type BannedTerm = { term: string; reason: TextReason; kind: (typeof BANNED_KINDS)[number] };

// « C0nn@rd », « c*nnard », « S.A.L.O.P.E » : leet et séparateurs décodés ; mots séparés par une espace.
export function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[0@4$31]/g, (char) => ({ "0": "o", "@": "a", "4": "a", $: "s", "3": "e", "1": "i" })[char] ?? char)
    .replace(/(?<=\p{L})[*.\-_](?=\p{L})/gu, "")
    .replace(/[^\p{L}]+/gu, " ")
    .trim();
}

// Motifs de refus trouvés dans le texte ([] : texte accepté).
export function bannedTextReasons(text: string, terms: BannedTerm[]): TextReason[] {
  const normalized = normalizeText(text);
  const words = new Set(normalized.split(" "));
  const padded = ` ${normalized} `;
  const reasons = new Set<TextReason>();

  for (const { term, reason, kind } of terms) {
    const found =
      kind === "word"
        ? words.has(term)
        : kind === "prefix"
          ? [...words].some((word) => word.startsWith(term))
          : padded.includes(` ${term} `);
    if (found) reasons.add(reason);
  }
  return [...reasons];
}

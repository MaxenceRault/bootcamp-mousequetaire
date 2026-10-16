// Version en vigueur de chaque document (date de publication) : enregistrée avec chaque consentement, comme preuve.
// Modifier un texte = changer sa version ici.
export const LEGAL_VERSIONS = { terms: "2026-10-17", sales: "2026-10-17" } as const;

export const LEGAL_PAGES = ["terms", "sales", "notice", "privacy"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

// Textes encore en brouillon (champs [À COMPLÉTER], relecture à faire) : un bandeau le signale sur chaque page.
export const LEGAL_DRAFT = true;

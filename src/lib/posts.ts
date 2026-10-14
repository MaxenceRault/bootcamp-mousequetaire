// Types de récit : servent d'onglets au feed et de choix dans l'éditeur.
// Doivent rester identiques aux slugs de la table archetype (db/migrations/).
// Libellés affichés : namespace « Archetypes » de messages/fr.json.
export const POST_ARCHETYPES = [
  "slow_travel_photography",
  "solo_architecture",
  "culinary_heritage",
  "mountain_trek",
] as const;
export type PostArchetype = (typeof POST_ARCHETYPES)[number];

// Post tel qu'affiché dans une carte du feed (TravelCard).
export type FeedPost = {
  id: number;
  title: string;
  shortDescription: string;
  // Ville, sinon région ; null si la destination est un pays entier (la carte affiche alors le pays).
  location: string | null;
  countryCode: string;
  archetype: PostArchetype;
  photoUrl: string;
  photoAlt: string;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarSeed: string | null;
  };
};

// Une page du feed. nextCursor : id à passer pour charger la suite (null = plus rien à charger).
export type FeedPage = { posts: FeedPost[]; nextCursor: number | null };

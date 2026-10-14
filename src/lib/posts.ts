import { DEMO_POSTS } from "@/lib/demo-posts";

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

export type FeedPost = {
  id: string;
  title: string;
  content: string;
  location: string;
  countryCode: string;
  tag: string | null;
  highlight: string | null;
  imageUrl: string;
  imageAlt: string;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

const FEED_LIMIT = 20;

// Posts les plus récents, filtrés par type de récit si besoin.
// Temporaire : lit les données de démo locales. À remplacer par l'appel à l'API back-end
// (même signature, pour que la page et les composants n'aient pas à changer).
export async function getFeedPosts(archetype?: PostArchetype): Promise<FeedPost[]> {
  const now = Date.now();

  return DEMO_POSTS.filter((post) => !archetype || post.archetype === archetype)
    .map(({ hoursAgo, ...post }) => ({
      ...post,
      createdAt: new Date(now - hoursAgo * 3_600_000),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, FEED_LIMIT);
}

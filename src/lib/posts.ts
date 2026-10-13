import { DEMO_POSTS } from "@/lib/demo-posts";

export const POST_CATEGORIES = ["culture", "coast", "food", "ai_curated"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

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
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

const FEED_LIMIT = 20;

// Posts les plus récents, filtrés par catégorie si besoin.
// Temporaire : lit les données de démo locales. À remplacer par l'appel à l'API back-end
// (même signature, pour que la page et les composants n'aient pas à changer).
export async function getFeedPosts(category?: PostCategory): Promise<FeedPost[]> {
  const now = Date.now();

  return DEMO_POSTS.filter((post) => !category || post.category === category)
    .map(({ hoursAgo, ...post }) => ({
      ...post,
      createdAt: new Date(now - hoursAgo * 3_600_000),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, FEED_LIMIT);
}

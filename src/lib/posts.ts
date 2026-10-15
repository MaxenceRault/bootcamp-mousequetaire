// Type de récit géré depuis l'admin. slug : identifiant stable (URL ?archetype=).
export type Archetype = { slug: string; label: string };

export type FeedPost = {
  id: number;
  title: string;
  slug: string;
  shortDescription: string;
  // Ville, sinon région ; null pour un pays entier.
  location: string | null;
  countryCode: string;
  archetype: Archetype;
  photoUrl: string;
  photoAlt: string;
  createdAt: Date;
  likeCount: number;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarSeed: string | null;
    avatarBackgroundColor: string | null;
  };
};

// nextCursor null : plus rien à charger.
export type FeedPage = { posts: FeedPost[]; nextCursor: number | null };

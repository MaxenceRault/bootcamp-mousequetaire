import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Hôte Supabase (ex. abcd.supabase.co) : les photos des posts sont servies par son Storage.
// next.config est lu au démarrage, hors de src/ : seule exception à la règle « getConfig() ».
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      // Photos et avatars des données de démo (seed).
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" },
      // Photos de couverture envoyées depuis l'éditeur (bucket post-photos, lecture publique).
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/post-photos/**" }]
        : []),
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Branche next-intl : il charge automatiquement src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

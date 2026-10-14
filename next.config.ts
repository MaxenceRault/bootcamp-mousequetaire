import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Hôte du projet Supabase (photos des posts dans le bucket public « post-photos »).
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      // Photos et avatars des données de démo.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" },
      // Photos de couverture des posts (uniquement ce bucket).
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

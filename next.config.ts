import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      // Photos et avatars des données de démo.
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" },
      // Photos de couverture des posts (uniquement le bucket Cloud Storage biirb-post-photos).
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/biirb-post-photos/**" },
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

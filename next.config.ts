import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// En-têtes de sécurité HTTP (équivalent Helmet, CLAUDE.md règle 9), appliqués à toutes les pages et routes.
// next.config est lu au démarrage, hors de src/ : NODE_ENV y est lu directement.
const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy : n'autorise que les ressources de l'app et des hôtes d'images connus.
// 'unsafe-inline' pour les scripts : Next injecte des scripts en ligne (données du rendu serveur) ;
// un nonce par requête imposerait un rendu dynamique de toutes les pages (incompatible avec cacheComponents).
// En dev : 'unsafe-eval' et WebSocket pour le rechargement à chaud de Next.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // blob: aperçu local de la photo dans l'éditeur ; data: icônes de Swagger UI (dev).
  "img-src 'self' data: blob: https://images.unsplash.com https://storage.googleapis.com",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Interdit d'afficher l'app dans une iframe d'un autre site (clickjacking, ex. sur la page de connexion).
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HTTPS obligatoire pendant 2 ans (production uniquement : en local, l'app tourne en HTTP).
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Ne pas annoncer la technologie du serveur (en-tête « X-Powered-By: Next.js »).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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

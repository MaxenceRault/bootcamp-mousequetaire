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

// CORS de l'API (CLAUDE.md règle 2) : seule l'URL publique du site est autorisée, jamais « * ».
// APP_URL est lue au build (les en-têtes sont figés dans le build) : argument du build Docker.
// Sans APP_URL (dev), aucun en-tête CORS : le navigateur refuse tout appel venant d'une autre origine.
const appUrl = process.env.APP_URL;
const corsHeaders = appUrl
  ? [
      { key: "Access-Control-Allow-Origin", value: appUrl },
      { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
      { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
      { key: "Access-Control-Max-Age", value: "600" },
      { key: "Vary", value: "Origin" },
    ]
  : [];

const nextConfig: NextConfig = {
  // Image Docker légère (Cloud Run) : serveur Node autonome avec uniquement les dépendances utilisées.
  output: "standalone",
  // Ne pas annoncer la technologie du serveur (en-tête « X-Powered-By: Next.js »).
  poweredByHeader: false,
  // Dev conteneurisé (compose.yaml) : les notifications de modification de fichiers ne traversent pas
  // le montage du code (Podman / Docker sur macOS et Windows) → surveillance par polling. Absent ailleurs.
  ...(process.env.WATCH_POLL_INTERVAL_MS
    ? { watchOptions: { pollIntervalMs: Number(process.env.WATCH_POLL_INTERVAL_MS) } }
    : {}),
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...(corsHeaders.length > 0 ? [{ source: "/api/:path*", headers: corsHeaders }] : []),
    ];
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

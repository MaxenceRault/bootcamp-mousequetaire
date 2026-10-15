import type { MetadataRoute } from "next";

// Installation sur l'écran d'accueil (PWA) : ouvre directement les voyages, consultables hors ligne.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brb — Be Right Back",
    short_name: "Brb",
    start_url: "/planner",
    display: "standalone",
    background_color: "#f8f9fa",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

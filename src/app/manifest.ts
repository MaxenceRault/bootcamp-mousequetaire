import type { MetadataRoute } from "next";

// Installation sur l'écran d'accueil (PWA) : ouvre directement les voyages, consultables hors ligne.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Biirb",
    short_name: "Biirb",
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

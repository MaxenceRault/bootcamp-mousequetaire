import { regenerateTripController } from "@/lib/controllers/trip.controller";

// Appel à Gemini : jusqu'à ~1 min pour un voyage d'un mois.
export const maxDuration = 120;
export const POST = regenerateTripController;

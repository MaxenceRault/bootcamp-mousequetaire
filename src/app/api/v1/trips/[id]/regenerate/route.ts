import { regenerateTripController } from "@/lib/controllers/trip.controller";

// Appel à Gemini : jusqu'à ~30 s.
export const maxDuration = 60;
export const POST = regenerateTripController;

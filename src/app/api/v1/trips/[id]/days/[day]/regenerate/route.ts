import { regenerateTripDayController } from "@/server/controllers/trip.controller";

// Gemini : un seul jour, bien plus court qu'un voyage entier.
export const maxDuration = 60;
export const POST = regenerateTripDayController;

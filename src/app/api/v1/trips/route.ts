import { createTripController, listTripsController } from "@/lib/controllers/trip.controller";

export const GET = listTripsController;
// Gemini : jusqu'à ~1 min pour un voyage d'un mois.
export const maxDuration = 120;
export const POST = createTripController;

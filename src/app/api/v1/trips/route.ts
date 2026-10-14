import { createTripController, listTripsController } from "@/lib/controllers/trip.controller";

export const GET = listTripsController;
// Création = génération par Gemini : jusqu'à ~30 s.
export const maxDuration = 60;
export const POST = createTripController;

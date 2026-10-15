import { deleteTripController, getTripController, updateTripController } from "@/server/controllers/trip.controller";

export const GET = getTripController;
export const PATCH = updateTripController;
export const DELETE = deleteTripController;

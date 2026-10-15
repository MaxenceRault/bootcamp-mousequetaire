import { listTripMessagesController, sendTripMessageController } from "@/server/controllers/trip.controller";

export const maxDuration = 60;
export const GET = listTripMessagesController;
export const POST = sendTripMessageController;

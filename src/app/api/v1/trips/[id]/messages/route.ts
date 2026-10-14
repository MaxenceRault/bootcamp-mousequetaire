import { listTripMessagesController, sendTripMessageController } from "@/lib/controllers/trip.controller";

export const maxDuration = 60;
export const GET = listTripMessagesController;
export const POST = sendTripMessageController;

import { createTicketController, listMyTicketsController } from "@/server/controllers/ticket.controller";

export const GET = listMyTicketsController;
export const POST = createTicketController;

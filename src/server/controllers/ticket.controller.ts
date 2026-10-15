import "server-only";
import { getConfig } from "@/server/config";
import { getUserIdFromRequest } from "@/server/jwt";
import { logError } from "@/server/logger";
import { isRateLimited } from "@/server/rateLimit";
import { createTicket, listMyTickets, TicketError } from "@/server/services/ticket.service";
import { createTicketSchema } from "@/schemas/ticket.schema";

// GET /api/v1/tickets (Bearer) → { tickets } : mes tickets, plus récents d'abord.
export async function listMyTicketsController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  try {
    return Response.json({ tickets: await listMyTickets(userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return internalError(error);
  }
}

// POST /api/v1/tickets (Bearer) { subject, message } → 201 ticket
export async function createTicketController(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  const { max, windowMs } = getConfig().rateLimits.ticket;
  if (isRateLimited(`tickets:create:${userId}`, max, windowMs)) return errorResponse(429, "TOO_MANY_REQUESTS");

  const body = createTicketSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return errorResponse(400, "INVALID_INPUT");

  try {
    return Response.json(await createTicket(userId, body.data), { status: 201 });
  } catch (error) {
    if (error instanceof TicketError) return errorResponse(403, error.code);
    return internalError(error);
  }
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function internalError(error: unknown) {
  logError("tickets", error);
  return errorResponse(500, "INTERNAL_ERROR");
}

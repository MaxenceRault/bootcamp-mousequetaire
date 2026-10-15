import "server-only";
import { findTicketsByUser, insertTicket, type TicketRow } from "@/server/repositories/ticket.repository";
import { findUserAccess } from "@/server/repositories/user.repository";
import type { CreateTicketInput } from "@/schemas/ticket.schema";

export class TicketError extends Error {
  constructor(public readonly code: "FORBIDDEN") {
    super(code);
  }
}

const MY_TICKETS_LIMIT = 50;

// Compte relu en base : un compte banni (token encore valide) ne crée pas de ticket.
export async function createTicket(userId: string, input: CreateTicketInput): Promise<TicketRow> {
  const access = await findUserAccess(userId);
  if (!access || access.banned_at) throw new TicketError("FORBIDDEN");
  return insertTicket(userId, input.subject, input.message);
}

export function listMyTickets(userId: string): Promise<TicketRow[]> {
  return findTicketsByUser(userId, MY_TICKETS_LIMIT);
}

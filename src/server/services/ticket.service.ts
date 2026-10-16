import "server-only";
import { getTranslations } from "next-intl/server";
import { getMailConfig } from "@/server/config";
import { sendTextMail } from "@/server/infra/mailer";
import { logError, logInfo } from "@/server/logger";
import { findTicketsByUser, insertTicket, type TicketRow } from "@/server/repositories/ticket.repository";
import { findActiveAdminEmails, findUserAccess, findUsername } from "@/server/repositories/user.repository";
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
  const ticket = await insertTicket(userId, input.subject, input.message, input.category);
  if (ticket.category === "trip_pass") await notifyAdminsOfPassRequest(ticket, userId);
  return ticket;
}

// Demande de pass voyage : les admins sont prévenus pour l'activer vite. Jamais bloquant pour le ticket.
// Texte fixe (numéro du ticket, pseudo) : le message de l'utilisateur reste dans l'administration.
async function notifyAdminsOfPassRequest(ticket: TicketRow, userId: string) {
  const mail = getMailConfig();
  if (!mail) return logInfo("tickets", { ticketId: ticket.id, adminNotified: false, reason: "mail_not_configured" });

  try {
    const [admins, username, t] = await Promise.all([
      findActiveAdminEmails(),
      findUsername(userId),
      getTranslations({ locale: "fr", namespace: "TripPassRequestEmail" }),
    ]);
    if (admins.length === 0) return logInfo("tickets", { ticketId: ticket.id, adminNotified: false, reason: "no_admin" });

    const adminUrl = mail.appUrl ? `${mail.appUrl}/admin` : t("adminPath");
    // Un email par admin : aucun admin ne voit l'adresse des autres.
    await Promise.all(
      admins.map((to) =>
        sendTextMail(mail, {
          to,
          subject: t("subject", { id: ticket.id }),
          text: t("body", { id: ticket.id, username: username ?? "?", adminUrl }),
        }),
      ),
    );
    logInfo("tickets", { ticketId: ticket.id, adminNotified: true, recipients: admins.length });
  } catch (error) {
    logError("tickets", error);
  }
}

export function listMyTickets(userId: string): Promise<TicketRow[]> {
  return findTicketsByUser(userId, MY_TICKETS_LIMIT);
}

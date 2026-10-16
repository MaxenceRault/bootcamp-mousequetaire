"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FIELD_CLASS_NAME } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { apiFetch, getSessionSnapshot, subscribeSession } from "@/client/session";
import {
  TICKET_MESSAGE_MAX,
  TICKET_MESSAGE_MIN,
  TICKET_SUBJECT_MAX,
  TICKET_SUBJECT_MIN,
  TICKET_CATEGORIES,
  type TicketCategory,
  type TicketStatus,
} from "@/schemas/ticket.schema";

type Ticket = {
  id: number;
  subject: string;
  message: string;
  status: TicketStatus;
  category: TicketCategory;
  created_at: string;
  updated_at: string;
};

// Lien « Contacter le support » de la fenêtre du pass : /support?topic=trip_pass&trip=<uuid> pré-remplit la demande.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readPassPrefill(): { tripId: string | null } | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("topic") !== "trip_pass") return null;
  const trip = params.get("trip");
  return { tripId: trip && UUID.test(trip) ? trip : null };
}

const ERRORS = ["INVALID_INPUT", "TOO_MANY_REQUESTS", "FORBIDDEN"] as const;

// Réservé aux utilisateurs connectés : un ticket est rattaché au compte.
export function SupportView() {
  const t = useTranslations("Support");
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => undefined);

  if (session === undefined) return <Card className="h-64 animate-pulse bg-surface-muted" aria-hidden="true" />;
  if (!session) {
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <p className="text-body-md text-ink-soft">{t("loginRequired")}</p>
        <Link href="/login" className={buttonClassName("md")}>
          {t("login")}
        </Link>
      </Card>
    );
  }
  return <SupportTickets />;
}

function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ tickets: Ticket[] }>("/api/v1/tickets").then((result) => {
      if (cancelled) return;
      if ("error" in result) return setLoadError(true);
      setTickets(result.data.tickets);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <NewTicketForm onCreated={(ticket) => setTickets((current) => [ticket, ...(current ?? [])])} />
      <MyTickets tickets={tickets} loadError={loadError} />
    </>
  );
}

function NewTicketForm({ onCreated }: { onCreated: (ticket: Ticket) => void }) {
  const t = useTranslations("Support");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Monté côté navigateur seulement (après la session) : window est disponible.
  const [prefill] = useState(readPassPrefill);
  // "" : aucune catégorie choisie (le select est requis).
  const [category, setCategory] = useState<TicketCategory | "">(prefill ? "trip_pass" : "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    setSent(false);

    const result = await apiFetch<Ticket>("/api/v1/tickets", {
      method: "POST",
      body: { subject: String(data.get("subject") ?? ""), message: String(data.get("message") ?? ""), category },
    });
    setPending(false);

    if ("error" in result) {
      const code = ERRORS.find((known) => known === result.error);
      return setError(t(`errors.${code ?? "INTERNAL_ERROR"}`));
    }
    form.reset();
    setSent(true);
    onCreated(result.data);
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <h2 className="font-display text-headline-md text-ink">{t("newTitle")}</h2>
        <Field id="ticket-category" label={t("category")}>
          <select
            id="ticket-category"
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value as TicketCategory)}
            required
            className={`h-11 ${FIELD_CLASS_NAME}`}
          >
            <option value="" disabled>
              {t("categoryPlaceholder")}
            </option>
            {TICKET_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`categories.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        {category === "trip_pass" && <p className="text-body-sm text-ink-soft">{t("passHint")}</p>}
        <Field id="ticket-subject" label={t("subject")}>
          <Input
            id="ticket-subject"
            name="subject"
            defaultValue={prefill ? t("passPrefillSubject") : undefined}
            required
            minLength={TICKET_SUBJECT_MIN}
            maxLength={TICKET_SUBJECT_MAX}
            placeholder={t("subjectPlaceholder")}
          />
        </Field>
        <Field id="ticket-message" label={t("message")}>
          <Textarea
            id="ticket-message"
            name="message"
            defaultValue={prefill?.tripId ? t("passPrefillMessage", { id: prefill.tripId }) : undefined}
            required
            minLength={TICKET_MESSAGE_MIN}
            maxLength={TICKET_MESSAGE_MAX}
            placeholder={t("messagePlaceholder")}
            className="min-h-32"
          />
        </Field>
        <FormError>{error}</FormError>
        {sent && (
          <p role="status" className="rounded-lg bg-accent/10 px-4 py-3 text-body-md text-ink">
            {t("sent")}
          </p>
        )}
        <Button type="submit" disabled={pending} className="gap-2 self-end">
          <Icon name="send" className="size-4" />
          {pending ? t("sending") : t("submit")}
        </Button>
      </form>
    </Card>
  );
}

function MyTickets({ tickets, loadError }: { tickets: Ticket[] | null; loadError: boolean }) {
  const t = useTranslations("Support");
  const format = useFormatter();

  if (loadError) return <FormError>{t("errors.INTERNAL_ERROR")}</FormError>;
  if (!tickets) return <Card className="h-32 animate-pulse bg-surface-muted" aria-hidden="true" />;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-headline-md text-ink">{t("mineTitle")}</h2>
      {tickets.length === 0 ? (
        <Card className="p-6 text-body-md text-ink-soft">{t("empty")}</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Card className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-display text-label-lg text-ink">{ticket.subject}</p>
                  <TicketStatusBadge status={ticket.status} />
                </div>
                <p className="text-body-sm whitespace-pre-line text-ink-soft">{ticket.message}</p>
                <p className="text-label-sm text-ink-soft/70">
                  {t("createdAt", { date: format.dateTime(new Date(ticket.created_at), { dateStyle: "medium", timeStyle: "short" }) })}
                  {ticket.updated_at !== ticket.created_at &&
                    ` · ${t("updatedAt", { date: format.dateTime(new Date(ticket.updated_at), { dateStyle: "medium", timeStyle: "short" }) })}`}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { countryName, flagEmoji } from "@/lib/country";
import { apiFetch } from "@/client/session";

type PendingInvitation = {
  id: number;
  role: "editor" | "viewer";
  trip: { id: string; title: string; destination_country_code: string; destination_city: string | null; start_date: string; end_date: string };
  invited_by: string | null;
};

// Invitations reçues par pseudo (/planner) : rien n'est affiché s'il n'y en a pas.
export function TripInvitations() {
  const t = useTranslations("Planner.share");
  const format = useFormatter();
  const router = useRouter();
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [error, setError] = useState<"TRIP_FULL" | "INTERNAL_ERROR" | null>(null);

  useEffect(() => {
    apiFetch<{ invitations: PendingInvitation[] }>("/api/v1/trips/invitations").then((result) => {
      if ("data" in result) setInvitations(result.data.invitations);
    });
  }, []);

  async function answer(invitation: PendingInvitation, accepted: boolean) {
    setError(null);
    const result = await apiFetch(`/api/v1/trips/invitations/${invitation.id}`, { method: "PATCH", body: { accepted } });
    if (!("data" in result) && result.error !== "NOT_FOUND") return setError(result.error === "TRIP_FULL" ? "TRIP_FULL" : "INTERNAL_ERROR");
    if (accepted && "data" in result) return router.push(`/planner/${invitation.trip.id}`);
    setInvitations((current) => current.filter((item) => item.id !== invitation.id));
  }

  if (invitations.length === 0) return null;

  return (
    <section aria-labelledby="planner-invitations-title" className="flex flex-col gap-3">
      <h2 id="planner-invitations-title" className="flex items-center gap-2 font-display text-headline-sm text-ink">
        <Icon name="send" className="size-5 text-accent" />
        {t("receivedTitle", { count: invitations.length })}
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            <Card className="flex h-full flex-col gap-3 p-5">
              <span className="font-display text-label-sm text-ink-soft uppercase">
                {flagEmoji(invitation.trip.destination_country_code)}{" "}
                {invitation.trip.destination_city ?? countryName(invitation.trip.destination_country_code, "fr")}
              </span>
              <span className="font-display text-headline-sm text-ink">{invitation.trip.title}</span>
              <span className="text-body-sm text-ink-soft">
                {t("receivedFrom", {
                  name: invitation.invited_by ?? "",
                  role: invitation.role,
                  dates: format.dateTimeRange(new Date(invitation.trip.start_date), new Date(invitation.trip.end_date), {
                    day: "numeric",
                    month: "short",
                  }),
                })}
              </span>
              <div className="mt-auto flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => void answer(invitation, false)}>
                  {t("decline")}
                </Button>
                <Button size="sm" onClick={() => void answer(invitation, true)} className="gap-1.5">
                  <Icon name="check" className="size-4" />
                  {t("accept")}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {error && <FormError>{t(`errors.${error}`)}</FormError>}
    </section>
  );
}

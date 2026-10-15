"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { TripInvitations } from "@/components/TripInvitations";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { TripCard, type TripSummary } from "@/components/TripCard";
import { TripContextBar } from "@/components/TripContextBar";
import type { Archetype } from "@/lib/posts";
import { TRIP_MAX_DAYS } from "@/schemas/trip.schema";
import { apiFetch, getSessionSnapshot } from "@/client/session";
import { plannerError, type PlannerError } from "@/components/TripPlanner";

type AiQuota = { used: number; limit: number | null };

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; trips: TripSummary[]; aiQuota: AiQuota };

export function PlannerHome({ archetypes }: { archetypes: readonly Archetype[] }) {
  const t = useTranslations("Planner");
  const router = useRouter();
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PlannerError | null>(null);

  // Confort uniquement : la vraie protection est la vérification du JWT par l'API.
  useEffect(() => {
    if (!getSessionSnapshot()) return router.replace("/login");

    apiFetch<{ trips: TripSummary[]; aiQuota: AiQuota }>("/api/v1/trips").then((result) => {
      if ("data" in result) return setList({ status: "ready", ...result.data });
      if (result.error === "UNAUTHORIZED") return router.replace("/login");
      setList({ status: "error" });
    });
  }, [router]);

  // Next garde la page en mémoire (cacheComponents) : sans ce nettoyage, le bouton resterait « en cours » au retour.
  useEffect(
    () => () => {
      setPending(false);
      setError(null);
    },
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ["destinationCountry", "destinationState", "destinationCity", "startDate", "endDate", "archetype"]
        .map((key) => [key, form.get(key)])
        .filter(([, value]) => typeof value === "string" && value !== ""),
    );

    setPending(true);
    setError(null);
    const result = await apiFetch<{ id: number }>("/api/v1/trips", { method: "POST", body });
    if ("data" in result) return router.push(`/planner/${result.data.id}`);

    setPending(false);
    setError(plannerError(result.error));
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display-lg-mobile text-ink md:text-display-lg">{t("heading")}</h1>
        <p className="max-w-2xl text-body-md text-ink-soft">{t("subheading")}</p>
      </header>

      <section aria-labelledby="planner-create-title" className="flex flex-col gap-3">
        <h2 id="planner-create-title" className="flex items-center gap-2 font-display text-headline-sm text-ink">
          <Icon name="sparkles" className="size-5 text-accent" />
          {t("create.title")}
        </h2>
        <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-3">
          <TripContextBar idPrefix="trip" archetypes={archetypes} maxDays={TRIP_MAX_DAYS} disablePast />
          <div className="flex flex-col items-end gap-2">
            <FormError>{error && t(`errors.${error}`)}</FormError>
            {list.status === "ready" && list.aiQuota.limit !== null && (
              <p className="text-body-sm text-ink-soft">
                {t("create.quota", { used: list.aiQuota.used, limit: list.aiQuota.limit })}
              </p>
            )}
            {pending && (
              <p role="status" className="text-body-sm text-ink-soft">
                {t("create.pending")}
              </p>
            )}
            <Button type="submit" disabled={pending} className="w-full gap-2 sm:w-auto">
              <Icon name="sparkles" className="size-4.5" />
              {t("create.submit")}
            </Button>
          </div>
        </form>
      </section>

      <TripInvitations />

      <section aria-labelledby="planner-list-title" className="flex flex-col gap-3">
        <h2 id="planner-list-title" className="font-display text-headline-sm text-ink">
          {t("list.title")}
        </h2>
        <TripList state={list} />
      </section>
    </div>
  );
}

function TripList({ state }: { state: ListState }) {
  const t = useTranslations("Planner");

  if (state.status === "loading") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1].map((index) => (
          <Card key={index} className="h-28 animate-pulse bg-surface-muted" />
        ))}
      </div>
    );
  }
  if (state.status === "error") return <FormError>{t("list.loadError")}</FormError>;
  if (state.trips.length === 0) return <p className="text-body-md text-ink-soft">{t("list.empty")}</p>;

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {state.trips.map((trip) => (
        <li key={trip.id}>
          <TripCard trip={trip} />
        </li>
      ))}
    </ul>
  );
}

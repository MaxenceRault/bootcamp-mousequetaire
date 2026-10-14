"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { TripContextBar } from "@/components/TripContextBar";
import { countryName, flagEmoji } from "@/lib/country";
import type { PostArchetype } from "@/lib/posts";
import { apiFetch, getSessionSnapshot } from "@/lib/session";
import { plannerError, type PlannerError } from "@/components/TripPlanner";

// Voyage dans la liste (GET /api/v1/trips).
type TripSummary = {
  id: number;
  title: string;
  destination_country_code: string;
  destination_city: string | null;
  start_date: string;
  end_date: string;
  archetype: PostArchetype;
  item_count: number;
};

type ListState = { status: "loading" } | { status: "error" } | { status: "ready"; trips: TripSummary[] };

export function PlannerHome({ archetypes }: { archetypes: readonly PostArchetype[] }) {
  const t = useTranslations("Planner");
  const router = useRouter();
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PlannerError | null>(null);

  // Page réservée aux utilisateurs connectés (confort : la vraie protection est la vérification du JWT par l'API).
  useEffect(() => {
    if (!getSessionSnapshot()) return router.replace("/login");

    apiFetch<{ trips: TripSummary[] }>("/api/v1/trips").then((result) => {
      if ("data" in result) return setList({ status: "ready", trips: result.data.trips });
      if (result.error === "UNAUTHORIZED") return router.replace("/login");
      setList({ status: "error" });
    });
  }, [router]);

  // Génération : POST /api/v1/trips, puis ouverture du planning créé.
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
          <TripContextBar idPrefix="trip" archetypes={archetypes} />
          <div className="flex flex-col items-end gap-2">
            <FormError>{error && t(`errors.${error}`)}</FormError>
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
  const tArchetypes = useTranslations("Archetypes");
  const format = useFormatter();

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
          <Link
            href={`/planner/${trip.id}`}
            className="block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
          >
            <Card className="flex h-full flex-col gap-2 p-5 transition hover:border-ink-soft/30">
              <span className="font-display text-label-sm text-ink-soft uppercase">
                {flagEmoji(trip.destination_country_code)}{" "}
                {trip.destination_city ?? countryName(trip.destination_country_code, "fr")}
              </span>
              <span className="font-display text-headline-sm text-ink">{trip.title}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <Icon name="calendar" className="size-4" />
                  {format.dateTimeRange(new Date(trip.start_date), new Date(trip.end_date), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="category" className="size-4" />
                  {tArchetypes(trip.archetype)}
                </span>
                <span>{t("list.activities", { count: trip.item_count })}</span>
              </span>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { countryName, flagEmoji } from "@/lib/country";
import type { PostArchetype } from "@/lib/posts";

// Voyage dans une liste (GET /api/v1/trips).
export type TripSummary = {
  id: number;
  title: string;
  destination_country_code: string;
  destination_city: string | null;
  start_date: string;
  end_date: string;
  archetype: PostArchetype;
  item_count: number;
};

// Carte d'un voyage généré : planificateur et onglet « Itinéraires IA » du profil.
export function TripCard({ trip }: { trip: TripSummary }) {
  const t = useTranslations("Planner");
  const tArchetypes = useTranslations("Archetypes");
  const format = useFormatter();

  return (
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
  );
}

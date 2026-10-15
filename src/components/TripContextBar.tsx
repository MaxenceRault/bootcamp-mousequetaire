"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Autocomplete, type Suggestion } from "@/components/ui/Autocomplete";
import { Card } from "@/components/ui/Card";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { FormError } from "@/components/ui/FormError";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Archetype } from "@/lib/posts";
import { usePlaceSearch, type Place } from "@/client/hooks/usePlaceSearch";

type TripContextBarProps = {
  idPrefix: string;
  archetypes: readonly Archetype[];
  maxDays?: number;
  disablePast?: boolean;
};

const CONTEXT_INPUT_CLASS_NAME =
  "w-full min-w-0 bg-transparent text-body-md font-medium text-ink placeholder:text-ink-soft/50 focus:outline-none";

// Partagée par l'éditeur de récit et le planificateur ; les champs partent avec le formulaire parent.
export function TripContextBar({ idPrefix, archetypes, maxDays, disablePast }: TripContextBarProps) {
  const t = useTranslations("TripContextBar");

  return (
    <Card className="grid grid-cols-1 gap-2 p-2 md:grid-cols-3">
      <ContextField icon="pin" label={t("destination")} htmlFor={`${idPrefix}-destination`}>
        <DestinationField id={`${idPrefix}-destination`} />
      </ContextField>

      <ContextField icon="calendar" label={t("timeline")} htmlFor={`${idPrefix}-dates`}>
        <DateRangePicker
          id={`${idPrefix}-dates`}
          startName="startDate"
          endName="endDate"
          maxDays={maxDays}
          disablePast={disablePast}
        />
      </ContextField>

      <ContextField icon="category" label={t("archetype")} htmlFor={`${idPrefix}-archetype`}>
        <select
          id={`${idPrefix}-archetype`}
          name="archetype"
          defaultValue=""
          required
          className={`cursor-pointer ${CONTEXT_INPUT_CLASS_NAME}`}
        >
          <option value="" disabled>
            {t("archetypePlaceholder")}
          </option>
          {archetypes.map(({ slug, label }) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </select>
      </ContextField>
    </Card>
  );
}

// Seul un lieu choisi dans la liste est accepté (champs cachés pays / région / ville).
function DestinationField({ id }: { id: string }) {
  const t = useTranslations("TripContextBar");
  const input = useRef<HTMLInputElement>(null);
  const { query, places, error, changeQuery, reset } = usePlaceSearch();
  const [selected, setSelected] = useState<Place | null>(null);

  useEffect(() => {
    input.current?.setCustomValidity(query && !selected ? t("destinationPick") : "");
  }, [query, selected, t]);

  function handleSelect({ key }: Suggestion) {
    const place = places.find((option) => option.key === key);
    if (!place) return;
    setSelected(place);
    reset(place.label);
  }

  return (
    <>
      <Autocomplete
        ref={input}
        id={id}
        value={query}
        onValueChange={(value) => {
          changeQuery(value);
          setSelected(null);
        }}
        suggestions={places.map(({ key, label }) => ({ key, label }))}
        onSelect={handleSelect}
        placeholder={t("destinationPlaceholder")}
        required
        className={`truncate ${CONTEXT_INPUT_CLASS_NAME}`}
      />
      {selected && (
        <>
          <input type="hidden" name="destinationCountry" value={selected.country} />
          {selected.state && <input type="hidden" name="destinationState" value={selected.state} />}
          {selected.city && <input type="hidden" name="destinationCity" value={selected.city} />}
        </>
      )}
      {error && <FormError>{t("placesError")}</FormError>}
    </>
  );
}

function ContextField({
  icon,
  label,
  htmlFor,
  children,
}: {
  icon: IconName;
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 transition focus-within:ring-2 focus-within:ring-accent/25">
      <Icon name={icon} className="size-5 text-ink-soft" />
      <div className="flex min-w-0 flex-1 flex-col">
        <label htmlFor={htmlFor} className="font-display text-label-sm text-ink-soft uppercase">
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

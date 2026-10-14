"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Autocomplete, type Suggestion } from "@/components/ui/Autocomplete";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { PostArchetype } from "@/lib/posts";
import { usePlaceSearch, type Place } from "@/lib/usePlaceSearch";

type TripContextBarProps = {
  // Préfixe des id des champs (plusieurs formulaires peuvent coexister).
  idPrefix: string;
  // Slugs des types de récit (libellés dans le namespace « Archetypes » de fr.json).
  archetypes: readonly PostArchetype[];
  // Durée maximale (en jours, début et fin inclus) : la date de fin ne peut pas la dépasser.
  maxDays?: number;
};

// Champs transparents de la barre de contexte.
const CONTEXT_INPUT_CLASS_NAME =
  "w-full min-w-0 bg-transparent text-body-md font-medium text-ink placeholder:text-ink-soft/50 focus:outline-none";

// Barre « destination · dates · type de récit », partagée par l'éditeur de récit et le planificateur.
// Les champs partent avec le formulaire parent : destinationCountry / destinationState / destinationCity,
// startDate, endDate, archetype.
export function TripContextBar({ idPrefix, archetypes, maxDays }: TripContextBarProps) {
  const t = useTranslations("TripContextBar");
  const tArchetypes = useTranslations("Archetypes");
  const [startDate, setStartDate] = useState("");

  return (
    <Card className="grid grid-cols-1 gap-2 p-2 md:grid-cols-3">
      <ContextField icon="pin" label={t("destination")} htmlFor={`${idPrefix}-destination`}>
        <DestinationField id={`${idPrefix}-destination`} />
      </ContextField>

      <ContextField icon="calendar" label={t("timeline")}>
        <div className="flex items-center gap-1">
          <input
            name="startDate"
            type="date"
            aria-label={t("startDate")}
            value={startDate}
            onChange={(event) => setStartDate(event.currentTarget.value)}
            required
            className={CONTEXT_INPUT_CLASS_NAME}
          />
          <span aria-hidden="true" className="text-ink-soft">
            →
          </span>
          {/* La date de fin ne peut pas précéder la date de début (ni dépasser la durée maximale). */}
          <input
            name="endDate"
            type="date"
            aria-label={t("endDate")}
            min={startDate || undefined}
            max={startDate && maxDays ? addDays(startDate, maxDays - 1) : undefined}
            required
            className={CONTEXT_INPUT_CLASS_NAME}
          />
        </div>
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
          {archetypes.map((archetype) => (
            <option key={archetype} value={archetype}>
              {tArchetypes(archetype)}
            </option>
          ))}
        </select>
      </ContextField>
    </Card>
  );
}

// Date « AAAA-MM-JJ » décalée de n jours (calcul en UTC : pas de décalage dû au fuseau horaire).
function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Destination : un lieu à choisir dans les suggestions.
// Seul un lieu choisi dans la liste est accepté : il part dans des champs cachés (pays, région, ville).
function DestinationField({ id }: { id: string }) {
  const t = useTranslations("TripContextBar");
  const input = useRef<HTMLInputElement>(null);
  const { query, places, error, changeQuery, reset } = usePlaceSearch();
  const [selected, setSelected] = useState<Place | null>(null);

  // Texte saisi sans choisir de suggestion : le navigateur bloque l'envoi avec ce message.
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

// Case de la barre : icône + petit label en capitales + champ transparent.
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

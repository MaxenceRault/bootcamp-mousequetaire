"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";

type DateRangePickerProps = {
  // Noms des champs envoyés avec le formulaire (dates « AAAA-MM-JJ »).
  startName: string;
  endName: string;
  // Interdit les dates passées (ex. planificateur ; un récit raconte au contraire un voyage passé).
  disablePast?: boolean;
  // Durée maximale en jours, début et fin inclus : les dates au-delà sont grisées.
  maxDays?: number;
  // Id du bouton (pour le <label> du parent).
  id?: string;
  className?: string;
};

// Jours manipulés en chaînes « AAAA-MM-JJ » et calculés en UTC : aucun décalage dû au fuseau horaire.
function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDay(date);
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

function todayDay() {
  const now = new Date();
  return toDay(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

// Premier jour du mois (UTC), décalé de `offset` mois.
function monthStart(year: number, month: number, offset = 0) {
  return new Date(Date.UTC(year, month + offset, 1));
}

// Cases d'un mois : semaines commençant le lundi, cases vides (null) avant le 1er.
function monthCells(month: Date) {
  const year = month.getUTCFullYear();
  const index = month.getUTCMonth();
  const leading = (month.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: count }, (_, day) => toDay(new Date(Date.UTC(year, index, day + 1)))),
  ];
}

// Sélecteur de période façon comparateur de vols : deux mois côte à côte (un seul sur mobile),
// un clic pour le départ, un pour le retour, la période surlignée.
export function DateRangePicker({ startName, endName, disablePast = false, maxDays, id, className = "" }: DateRangePickerProps) {
  const t = useTranslations("DateRangePicker");
  const format = useFormatter();
  const popoverId = useId();
  const root = useRef<HTMLDivElement>(null);
  const validity = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Mois affiché et date du jour : calculés à l'ouverture, côté navigateur uniquement
  // (jamais pendant le pré-rendu serveur, où la date du jour n'a pas de sens).
  const [view, setView] = useState<Date | null>(null);
  const [today, setToday] = useState<string | null>(null);

  const minDay = disablePast ? today : null;
  // Départ choisi, retour pas encore : au-delà de la durée maximale, les jours sont grisés.
  const maxDay = start && !end && maxDays ? addDays(start, maxDays - 1) : null;
  const complete = Boolean(start && end);

  // Période incomplète : le navigateur bloque l'envoi du formulaire avec ce message.
  useEffect(() => {
    validity.current?.setCustomValidity(complete ? "" : t("required"));
  }, [complete, t]);

  // Fermeture au clic en dehors et avec Échap.
  useEffect(() => {
    if (!open) return;
    function handlePointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const now = todayDay();
      setToday(now);
      // Ouvre sur le mois du départ s'il est choisi, sinon sur le mois en cours.
      const focus = start ?? now;
      setView(monthStart(Number(focus.slice(0, 4)), Number(focus.slice(5, 7)) - 1));
    }
    setOpen((value) => !value);
  }

  function isDisabled(day: string) {
    return Boolean((minDay && day < minDay) || (maxDay && day > maxDay));
  }

  function select(day: string) {
    if (isDisabled(day)) return;
    if (!start || end || day < start) {
      setStart(day);
      setEnd(null);
      return;
    }
    setEnd(day);
    setOpen(false);
  }

  function clear() {
    setStart(null);
    setEnd(null);
  }

  // Fin affichée : le retour choisi, ou le jour survolé (aperçu de la période).
  const previewEnd = end ?? (start && hovered && hovered >= start && !isDisabled(hovered) ? hovered : null);
  // Survol d'un jour trop éloigné : on explique pourquoi il n'est pas sélectionnable.
  const tooFar = Boolean(maxDay && hovered && hovered > maxDay);
  const selectedDays = start && end ? daysBetween(start, end) + 1 : null;

  const shortDate = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00`), { weekday: "short", day: "numeric", month: "short" });

  const months = view ? [view, monthStart(view.getUTCFullYear(), view.getUTCMonth(), 1)] : [];
  const canGoBack = Boolean(view && (!minDay || toDay(view) > minDay.slice(0, 8) + "01"));

  function moveView(offset: number) {
    if (view) setView(monthStart(view.getUTCFullYear(), view.getUTCMonth(), offset));
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={popoverId}
        className="flex w-full min-w-0 items-center gap-1 text-left text-body-md font-medium text-ink focus:outline-none"
      >
        <span className={start ? "truncate" : "truncate text-ink-soft/50"}>{start ? shortDate(start) : t("start")}</span>
        <span aria-hidden="true" className="text-ink-soft">
          →
        </span>
        <span className={end ? "truncate" : "truncate text-ink-soft/50"}>{end ? shortDate(end) : t("end")}</span>
      </button>

      {/* Contrôle de validité du formulaire (invisible, sous le bouton) + valeurs envoyées. */}
      <input
        ref={validity}
        tabIndex={-1}
        aria-hidden="true"
        value={complete ? `${start}/${end}` : ""}
        onChange={() => {}}
        required
        className="pointer-events-none absolute inset-0 opacity-0"
      />
      {start && <input type="hidden" name={startName} value={start} />}
      {end && <input type="hidden" name={endName} value={end} />}

      {open && view && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={t("dialog")}
          className="absolute top-full left-0 z-50 mt-3 w-[min(92vw,640px)] rounded-lg border border-line bg-surface p-4 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveView(-1)}
              disabled={!canGoBack}
              aria-label={t("previous")}
              className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface-muted hover:text-ink disabled:invisible"
            >
              <Icon name="chevronDown" className="size-5 rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => moveView(1)}
              aria-label={t("next")}
              className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface-muted hover:text-ink"
            >
              <Icon name="chevronDown" className="size-5 -rotate-90" />
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2" onPointerLeave={() => setHovered(null)}>
            {months.map((month, index) => (
              <MonthGrid
                key={toDay(month)}
                month={month}
                // Second mois masqué sur mobile.
                className={index === 1 ? "hidden md:block" : ""}
                start={start}
                end={previewEnd}
                today={today}
                isDisabled={isDisabled}
                onSelect={select}
                onHover={setHovered}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <p
              role={tooFar ? "alert" : "status"}
              className={`text-body-sm ${tooFar ? "text-error" : "text-ink-soft"}`}
            >
              {tooFar && maxDays
                ? t("tooLong", { max: maxDays })
                : selectedDays
                  ? t("selected", { count: selectedDays })
                  : start
                    ? maxDays
                      ? t("pickEndMax", { max: maxDays })
                      : t("pickEnd")
                    : t("pickStart")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-lg px-3 py-1.5 font-display text-label-md text-ink-soft transition hover:bg-surface-muted hover:text-ink"
              >
                {t("clear")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-ink px-3 py-1.5 font-display text-label-md text-surface transition hover:opacity-90"
              >
                {t("done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  month,
  className,
  start,
  end,
  today,
  isDisabled,
  onSelect,
  onHover,
}: {
  month: Date;
  className: string;
  start: string | null;
  end: string | null;
  today: string | null;
  isDisabled: (day: string) => boolean;
  onSelect: (day: string) => void;
  onHover: (day: string | null) => void;
}) {
  const format = useFormatter();
  // Lundi 5 janvier 1970 → dimanche : libellés courts des jours de la semaine.
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    format.dateTime(new Date(Date.UTC(1970, 0, 5 + index, 12)), { weekday: "narrow" }),
  );

  return (
    <div className={className}>
      <p className="mb-2 text-center font-display text-label-lg text-ink capitalize">
        {format.dateTime(new Date(month.getTime() + 12 * 3_600_000), { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 text-center">
        {weekdays.map((weekday, index) => (
          <span key={index} aria-hidden="true" className="py-1 text-label-sm text-ink-soft">
            {weekday}
          </span>
        ))}
        {monthCells(month).map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;

          const disabled = isDisabled(day);
          const isStart = day === start;
          const isEnd = day === end;
          const inRange = Boolean(start && end && day > start && day < end);
          const edge = isStart || isEnd;

          return (
            <div
              key={day}
              className={`py-0.5 ${inRange ? "bg-surface-muted" : ""} ${
                isStart && end && end !== start ? "rounded-l-full bg-surface-muted" : ""
              } ${isEnd && start && end !== start ? "rounded-r-full bg-surface-muted" : ""}`}
            >
              <button
                type="button"
                // aria-disabled (et non disabled) : le survol reste détecté pour expliquer pourquoi le jour est grisé.
                aria-disabled={disabled}
                onClick={() => onSelect(day)}
                onPointerEnter={() => onHover(day)}
                aria-pressed={edge}
                aria-label={format.dateTime(new Date(`${day}T12:00:00`), { dateStyle: "full" })}
                className={`mx-auto flex size-9 items-center justify-center rounded-full text-body-sm transition focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none ${
                  edge
                    ? "bg-ink font-semibold text-surface"
                    : disabled
                      ? "cursor-not-allowed text-ink-soft/30 line-through"
                      : "text-ink hover:bg-line/60"
                } ${day === today && !edge ? "font-semibold underline underline-offset-4" : ""}`}
              >
                {Number(day.slice(8))}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

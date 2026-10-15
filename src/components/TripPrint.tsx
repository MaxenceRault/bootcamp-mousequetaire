"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { budgetTotal, CATEGORY_ICONS, parseDay, tripDays, type TripDetail } from "@/components/TripPlanner";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { countryName, flagEmoji } from "@/lib/country";
import { apiFetch, getSessionSnapshot } from "@/client/session";

// Document imprimable du planning : la fenêtre d'impression s'ouvre dès qu'il est chargé.
export function TripPrint({ tripId }: { tripId: number }) {
  const t = useTranslations("TripExport");
  const tPlanner = useTranslations("Planner");
  const format = useFormatter();
  const router = useRouter();
  const [detail, setDetail] = useState<TripDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!getSessionSnapshot()) return router.replace("/login");
    apiFetch<TripDetail>(`/api/v1/trips/${tripId}`).then((result) => {
      if ("data" in result) return setDetail(result.data);
      if (result.error === "UNAUTHORIZED") return router.replace("/login");
      setFailed(true);
    });
  }, [router, tripId]);

  useEffect(() => {
    if (!detail) return;
    // Polices chargées avant l'impression, sinon le PDF part avec la police de secours.
    document.fonts.ready.then(() => window.print());
  }, [detail]);

  if (failed) {
    return (
      <div className="p-10">
        <FormError>{t("error")}</FormError>
      </div>
    );
  }
  if (!detail) return <p className="p-10 text-body-md text-ink-soft">{t("loading")}</p>;

  const { trip, items, tasks } = detail;
  const days = tripDays(trip.start_date, trip.end_date);
  const total = budgetTotal(trip);
  const destination = [trip.destination_city, countryName(trip.destination_country_code, "fr")].filter(Boolean).join(", ");
  const budget = [
    [tPlanner("budget.lodging"), trip.budget_lodging],
    [tPlanner("budget.transit"), trip.budget_transit],
    [tPlanner("budget.dining"), trip.budget_dining],
    [tPlanner("budget.activities"), trip.budget_activities],
  ] as const;

  return (
    <div className="min-h-screen bg-canvas print:min-h-0 print:bg-surface">
      <div className="mx-auto flex max-w-200 items-center justify-between gap-3 px-6 py-4 print:hidden">
        <p className="text-body-sm text-ink-soft">{t("hint")}</p>
        <Button size="sm" onClick={() => window.print()} className="shrink-0 gap-1.5">
          <Icon name="print" className="size-4" />
          {t("print")}
        </Button>
      </div>

      <article className="mx-auto flex max-w-200 flex-col gap-8 bg-surface p-10 text-ink shadow-sm print:max-w-none print:gap-5 print:p-0 print:shadow-none">
        <header className="flex items-center justify-between gap-4 border-b-2 border-accent pb-4">
          <div className="flex items-center gap-3">
            <Logo className="size-12" />
            <span className="font-display text-headline-md">{t("brand")}</span>
          </div>
          <div className="text-right">
            <p className="font-display text-label-lg uppercase">{t("documentTitle")}</p>
            <p className="text-body-sm text-ink-soft">
              {t("exportedOn", { date: format.dateTime(new Date(), { dateStyle: "long" }) })}
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-2">
          <h1 className="font-display text-headline-lg">{trip.title}</h1>
          <p className="text-body-md text-ink-soft">
            {flagEmoji(trip.destination_country_code)} {destination} ·{" "}
            {format.dateTimeRange(parseDay(trip.start_date), parseDay(trip.end_date), { dateStyle: "long" })} ·{" "}
            {t("days", { count: days.length })} · {trip.archetype.label}
          </p>
          {trip.season_note && (
            <p className="mt-2 rounded-lg bg-surface-muted p-4 text-body-sm text-ink-soft print:border print:border-line">
              <span className="font-display font-semibold text-ink">{tPlanner("trip.seasonTitle")} : </span>
              {trip.season_note}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3 break-inside-avoid">
          <h2 className="font-display text-headline-sm">{tPlanner("budget.title")}</h2>
          <table className="w-full text-body-sm">
            <tbody>
              {budget.map(([label, amount]) => (
                <tr key={label} className="border-b border-line">
                  <td className="py-1.5">{label}</td>
                  <td className="py-1.5 text-right">{t("euros", { amount })}</td>
                </tr>
              ))}
              <tr className="font-display font-semibold">
                <td className="py-1.5">{t("total")}</td>
                <td className="py-1.5 text-right">
                  {t("euros", { amount: total })}
                  {trip.budget_target !== null && ` / ${t("euros", { amount: trip.budget_target })}`}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="flex flex-col gap-5 print:gap-3">
          <h2 className="font-display text-headline-sm">{tPlanner("days.title")}</h2>
          {days.map((day, index) => {
            const dayItems = items.filter((item) => item.day === day);
            return (
              <div key={day} className="flex flex-col gap-2 break-inside-avoid">
                <h3 className="font-display text-label-lg text-accent">
                  {tPlanner("days.heading", {
                    number: index + 1,
                    date: format.dateTime(parseDay(day), { weekday: "long", day: "numeric", month: "long" }),
                  })}
                </h3>
                {dayItems.length === 0 ? (
                  <p className="text-body-sm text-ink-soft">{tPlanner("days.empty")}</p>
                ) : (
                  <ul className="flex flex-col">
                    {dayItems.map((item) => (
                      <li key={item.id} className="flex gap-4 border-b border-line py-2 last:border-0 print:py-1.5">
                        <span className="w-12 shrink-0 font-display text-label-lg">{item.start_time}</span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 font-display text-label-lg">
                            <Icon name={CATEGORY_ICONS[item.category]} className="size-4 text-ink-soft" />
                            {item.title}
                          </span>
                          {item.description && <p className="text-body-sm text-ink-soft">{item.description}</p>}
                          {item.source_post && (
                            <p className="text-label-sm text-ink-soft">
                              {tPlanner("item.source")} {item.source_post.title}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        {tasks.length > 0 && (
          <section className="flex flex-col gap-2 break-inside-avoid">
            <h2 className="font-display text-headline-sm">{tPlanner("tasks.title")}</h2>
            <ul className="flex flex-col gap-1.5 text-body-sm">
              {tasks.map((task) => (
                <li key={task.id} className="flex gap-2">
                  <span aria-hidden="true">{task.done ? "☑" : "☐"}</span>
                  <span>
                    {task.label}
                    {task.detail && <span className="text-ink-soft"> — {task.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="flex break-inside-avoid items-center justify-between gap-3 border-t border-line pt-4 text-label-sm text-ink-soft">
          <span className="flex items-center gap-1.5">
            <Logo className="size-5" />
            {t("footer")}
          </span>
          <span>{typeof window === "undefined" ? "" : window.location.host}</span>
        </footer>
      </article>
    </div>
  );
}

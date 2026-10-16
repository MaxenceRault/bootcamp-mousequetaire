"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/client/session";
import type { TripRole } from "@/components/TripSharePanel";

export type TripPass = { active: boolean; available: boolean; priceEur: number | null };

export const TRIP_PASS_CARD_ID = "trip-pass";

const BENEFITS = ["ai", "day", "exports"] as const;

// Offre du pass voyage (voyage sans pass). Le pass est activé par le webhook Buy Me a Coffee, jamais par le navigateur.
export function TripPassCard({
  tripId,
  pass,
  role,
  onRefresh,
}: {
  tripId: number;
  pass: TripPass;
  role: TripRole;
  onRefresh: () => Promise<boolean>;
}) {
  const t = useTranslations("Planner");
  const format = useFormatter();
  const [checkout, setCheckout] = useState<{ url: string; email: string | null } | null>(null);
  const [pending, setPending] = useState(false);
  const [notYet, setNotYet] = useState(false);
  // Le lien de paiement n'apparaît qu'après confirmation de l'adresse : le webhook ne connaît que l'email du paiement.
  const [confirmed, setConfirmed] = useState(false);
  // CGV et renonciation au droit de rétractation : non pré-cochées, revérifiées par l'API.
  const [acceptSales, setAcceptSales] = useState(false);
  const [waiveWithdrawal, setWaiveWithdrawal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    const result = await apiFetch<{ url: string; email: string | null }>(`/api/v1/trips/${tripId}/pass`, {
      method: "POST",
      body: { acceptSales, waiveWithdrawal },
    });
    setPending(false);
    if ("data" in result) return setCheckout(result.data);
    setError(["PASS_ALREADY_ACTIVE", "PASS_UNAVAILABLE", "FORBIDDEN", "TOO_MANY_REQUESTS"].includes(result.error) ? result.error : "INTERNAL_ERROR");
  }

  async function refresh() {
    setPending(true);
    setNotYet(!(await onRefresh()));
    setPending(false);
  }

  return (
    <Card id={TRIP_PASS_CARD_ID} className="flex scroll-mt-24 flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-display text-headline-sm text-ink">
          <Icon name="sparkles" className="size-5 text-accent" />
          {t("pass.title")}
        </h2>
        <p className="text-body-sm text-ink-soft">{t("pass.hint")}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex gap-2 text-body-sm text-ink">
            <Icon name="check" className="mt-0.5 size-4 shrink-0 text-accent" />
            {t(`pass.benefits.${benefit}`)}
          </li>
        ))}
      </ul>

      {!pass.available || pass.priceEur === null ? (
        <p className="text-body-sm text-ink-soft">{t("pass.unavailable")}</p>
      ) : role !== "owner" ? (
        <p className="text-body-sm text-ink-soft">{t("pass.ownerOnly")}</p>
      ) : checkout ? (
        <div className="flex flex-col gap-3">
          <p className="rounded-lg bg-surface-muted p-3 text-body-sm text-ink">
            {checkout.email ? t("pass.email", { email: checkout.email }) : t("pass.emailUnknown")}
          </p>
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.currentTarget.checked)}>
            {t("pass.confirmEmail")}
          </Checkbox>
          {confirmed && (
            <a href={checkout.url} target="_blank" rel="noopener noreferrer" className={buttonClassName("md", "gap-1.5")}>
              {t("pass.openPayment")}
            </a>
          )}
          <p className="text-label-sm text-ink-soft">
            {t("pass.otherEmail", { id: tripId })}{" "}
            <Link href="/support" className="font-medium text-accent hover:underline">
              {t("pass.support")}
            </Link>
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={pending} className="gap-1.5 self-start">
            <Icon name="refresh" className="size-4" />
            {t("pass.refresh")}
          </Button>
          {notYet && <p className="text-body-sm text-ink-soft">{t("pass.notYet")}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Checkbox checked={acceptSales} onChange={(event) => setAcceptSales(event.currentTarget.checked)} className="items-start">
            {t.rich("pass.acceptSales", {
              sales: (chunks) => (
                <Link href="/legal/sales" target="_blank" className="font-medium text-accent hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </Checkbox>
          <Checkbox checked={waiveWithdrawal} onChange={(event) => setWaiveWithdrawal(event.currentTarget.checked)} className="items-start">
            {t("pass.waiveWithdrawal")}
          </Checkbox>
          <Button onClick={() => void startCheckout()} disabled={pending || !acceptSales || !waiveWithdrawal} className="gap-1.5">
            <Icon name="lock" className="size-4.5" />
            {pending ? t("pass.opening") : t("pass.buy", { price: format.number(pass.priceEur, { style: "currency", currency: "EUR" }) })}
          </Button>
        </div>
      )}

      {error && <FormError>{t(`errors.${error as "INTERNAL_ERROR"}`)}</FormError>}
    </Card>
  );
}

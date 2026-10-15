"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonClassName } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, getSessionSnapshot, subscribeSession } from "@/client/session";

type PatronStatus = { enabled: boolean; minEur: number | null; isPatron: boolean; email: string | null; pageUrl: string | null };
type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: PatronStatus };

// Seule destination autorisée pour le lien de paiement.
const BMC_PAGE = /^https:\/\/(www\.)?buymeacoffee\.com\//;

// Page « Devenir mécène » : réservée aux utilisateurs connectés (le rôle est attaché au compte).
export function PatronView() {
  const t = useTranslations("Patron");
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => undefined);

  if (session === undefined) return <p className="text-center text-body-md text-ink-soft">{t("loading")}</p>;
  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-center text-body-md text-ink-soft">{t("loginRequired")}</p>
        <Link href="/login" className={buttonClassName("md")}>
          {t("login")}
        </Link>
      </div>
    );
  }
  return <PatronOffer />;
}

function PatronOffer() {
  const t = useTranslations("Patron");
  const format = useFormatter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Le rôle arrive par le webhook, quelques secondes après le paiement.
  async function handleCheck() {
    setChecking(true);
    const next = await fetchStatus();
    setState(next);
    setChecking(false);
    setNotYet(next.status === "ready" && !next.data.isPatron);
  }

  if (state.status === "loading") return <p className="text-center text-body-md text-ink-soft">{t("loading")}</p>;
  if (state.status === "error") return <FormError>{t("errors.INTERNAL_ERROR")}</FormError>;

  const { data } = state;
  if (data.isPatron) {
    return (
      <p role="status" className="rounded-lg bg-accent/10 px-4 py-3 text-center font-display text-label-lg text-ink">
        {t("alreadyPatron")}
      </p>
    );
  }
  if (!data.enabled || !data.pageUrl || !data.minEur || !BMC_PAGE.test(data.pageUrl)) {
    return <p className="text-center text-body-md text-ink-soft">{t("unavailable")}</p>;
  }
  const price = format.number(data.minEur, { style: "currency", currency: "EUR" });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center font-display text-headline-xl-mobile text-ink">
        {price} <span className="text-body-md text-ink-soft">{t("oneTime")}</span>
      </p>
      <p className="rounded-lg bg-surface-muted px-4 py-3 text-center text-body-md text-ink-soft">
        {t.rich("emailHint", { email: data.email ?? "", strong: (chunks) => <strong className="text-ink">{chunks}</strong> })}
      </p>
      <a
        href={data.pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClassName("md", "w-full gap-2")}
      >
        <Icon name="heartFilled" className="size-4" />
        {t("submit", { price })}
      </a>
      <Button variant="secondary" onClick={handleCheck} disabled={checking} className="w-full">
        {checking ? t("checking") : t("check")}
      </Button>
      {notYet && (
        <p role="status" className="text-center text-body-sm text-ink-soft">
          {t("notYet")}
        </p>
      )}
      <p className="flex items-center justify-center gap-1.5 text-center text-body-sm text-ink-soft/70">
        <Icon name="lock" className="size-3.5" />
        {t("secure")}
      </p>
    </div>
  );
}

async function fetchStatus(): Promise<LoadState> {
  const result = await apiFetch<PatronStatus>("/api/v1/users/me/patron");
  return "error" in result ? { status: "error" } : { status: "ready", data: result.data };
}

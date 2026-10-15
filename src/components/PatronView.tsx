"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, buttonClassName } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, getSessionSnapshot, subscribeSession } from "@/lib/session";

type PatronStatus = { enabled: boolean; isPatron: boolean; priceCents: number; currency: string };
type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: PatronStatus };

const ERRORS = ["ALREADY_PATRON", "PAYMENT_UNAVAILABLE", "TOO_MANY_REQUESTS", "UNAUTHORIZED"] as const;
// Seule destination autorisée après la création du paiement : la page hébergée par Stripe.
const STRIPE_CHECKOUT = "https://checkout.stripe.com/";

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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PatronStatus>("/api/v1/users/me/patron").then((result) => {
      if (!cancelled) setState("error" in result ? { status: "error" } : { status: "ready", data: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheckout() {
    setPending(true);
    setError(null);
    const result = await apiFetch<{ url: string }>("/api/v1/users/me/patron/checkout", { method: "POST" });

    if ("error" in result || !result.data.url.startsWith(STRIPE_CHECKOUT)) {
      setPending(false);
      const code = "error" in result ? ERRORS.find((known) => known === result.error) : undefined;
      return setError(t(`errors.${code ?? "INTERNAL_ERROR"}`));
    }
    window.location.assign(result.data.url);
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
  if (!data.enabled) return <p className="text-center text-body-md text-ink-soft">{t("unavailable")}</p>;

  const price = format.number(data.priceCents / 100, { style: "currency", currency: data.currency.toUpperCase() });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center font-display text-headline-xl-mobile text-ink">
        {price} <span className="text-body-md text-ink-soft">{t("oneTime")}</span>
      </p>
      <FormError>{error}</FormError>
      <Button onClick={handleCheckout} disabled={pending} className="w-full gap-2">
        <Icon name="heartFilled" className="size-4" />
        {pending ? t("redirecting") : t("submit", { price })}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-body-sm text-ink-soft/70">
        <Icon name="lock" className="size-3.5" />
        {t("secure")}
      </p>
    </div>
  );
}

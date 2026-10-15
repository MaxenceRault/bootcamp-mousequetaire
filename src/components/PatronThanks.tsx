"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, getSessionSnapshot } from "@/lib/session";

type Payment = { status: "paid" | "pending"; amountCents: number; currency: string } | null;
type State = { status: "loading" } | { status: "done"; payment: Payment };

// Retour de Stripe : état du paiement relu chez Stripe par notre API (le retour du navigateur ne prouve rien).
// Le rôle, lui, est attribué par le webhook de Stripe, en général en quelques secondes.
export function PatronThanks({ sessionId }: { sessionId: string | null }) {
  const t = useTranslations("Patron");
  const format = useFormatter();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!sessionId || !getSessionSnapshot()) {
      queueMicrotask(() => setState({ status: "done", payment: null }));
      return;
    }
    let cancelled = false;
    apiFetch<{ payment: Payment }>(`/api/v1/users/me/patron?session_id=${encodeURIComponent(sessionId)}`).then((result) => {
      if (!cancelled) setState({ status: "done", payment: "error" in result ? null : result.data.payment });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.status === "loading") return <p className="text-center text-body-md text-ink-soft">{t("loading")}</p>;

  const { payment } = state;
  const amount = payment
    ? format.number(payment.amountCents / 100, { style: "currency", currency: payment.currency.toUpperCase() })
    : "";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon name={payment ? "heartFilled" : "heart"} className="size-6" />
      </span>
      <h1 className="font-display text-headline-lg text-ink">
        {payment?.status === "paid" ? t("thanksTitle") : payment ? t("pendingTitle") : t("unknownTitle")}
      </h1>
      <p className="text-body-md text-ink-soft">
        {payment?.status === "paid" ? t("thanksText", { amount }) : payment ? t("pendingText", { amount }) : t("unknownText")}
      </p>
      <Link href="/profile" className={buttonClassName("md", "mt-2")}>
        {t("toProfile")}
      </Link>
    </div>
  );
}

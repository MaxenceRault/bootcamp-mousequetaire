"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { apiFetch, getSessionSnapshot } from "@/client/session";

// Gardé le temps de se connecter : le # est perdu au passage par /login.
const CODE_KEY = "brb_join_code";
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const JOIN_PATH = "/planner/join";

type JoinState = "loading" | "login" | "invalid" | "full" | "error";

// Code pris dans le # (puis retiré de l'URL) ou gardé depuis le passage par /login.
function readCode() {
  const fromHash = window.location.hash.slice(1);
  if (CODE_PATTERN.test(fromHash)) {
    sessionStorage.setItem(CODE_KEY, fromHash);
    history.replaceState(null, "", JOIN_PATH);
  }
  const code = sessionStorage.getItem(CODE_KEY);
  return code && CODE_PATTERN.test(code) ? code : null;
}

export function TripJoin() {
  const t = useTranslations("Planner.share");
  const router = useRouter();
  const [state, setState] = useState<JoinState>("loading");

  useEffect(() => {
    const code = readCode();
    const next: Promise<JoinState | null> = !code
      ? Promise.resolve("invalid")
      : !getSessionSnapshot()
        ? Promise.resolve("login")
        : apiFetch<{ tripId: string }>("/api/v1/trips/join", { method: "POST", body: { code } }).then((result) => {
            if ("data" in result) {
              sessionStorage.removeItem(CODE_KEY);
              router.replace(`/planner/${result.data.tripId}`);
              return null;
            }
            if (result.error === "UNAUTHORIZED") return "login";
            if (result.error === "TRIP_FULL") return "full";
            if (result.error === "INVITE_INVALID" || result.error === "INVALID_INPUT") {
              sessionStorage.removeItem(CODE_KEY);
              return "invalid";
            }
            return "error";
          });
    void next.then((value) => value && setState(value));
  }, [router]);

  return (
    <Card className="flex flex-col items-start gap-4 p-6">
      <h1 className="flex items-center gap-2 font-display text-headline-md text-ink">
        <Icon name="share" className="size-6 text-accent" />
        {t("joinTitle")}
      </h1>
      {state === "loading" && (
        <p role="status" className="text-body-md text-ink-soft">
          {t("joining")}
        </p>
      )}
      {state === "login" && (
        <>
          <p className="text-body-md text-ink-soft">{t("joinLogin")}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/login?next=${JOIN_PATH}`} className={buttonClassName("md")}>
              {t("login")}
            </Link>
            <Link href={`/login?view=register&next=${JOIN_PATH}`} className={buttonClassName("md", "", "secondary")}>
              {t("register")}
            </Link>
          </div>
        </>
      )}
      {(state === "invalid" || state === "full" || state === "error") && (
        <>
          <FormError>{t(state === "invalid" ? "joinInvalid" : state === "full" ? "errors.TRIP_FULL" : "errors.INTERNAL_ERROR")}</FormError>
          <Link href="/planner" className="text-label-lg text-accent hover:underline">
            {t("backToTrips")}
          </Link>
        </>
      )}
    </Card>
  );
}

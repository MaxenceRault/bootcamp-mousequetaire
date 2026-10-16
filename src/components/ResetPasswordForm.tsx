"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { PasswordInput } from "@/components/ui/PasswordInput";

const ERRORS = ["INVALID_INPUT", "INVALID_RESET_TOKEN", "TOO_MANY_REQUESTS"] as const;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Le code est dans le fragment (#token=…) : jamais envoyé au serveur avec la page.
function readToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  return token && TOKEN.test(token) ? token : "";
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  // null pendant le rendu serveur, "" si le lien est incomplet.
  const token = useSyncExternalStore(subscribeHash, readToken, () => null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) return setError(t("errors.PASSWORD_MISMATCH"));

    setPending(true);
    setError(null);
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.get("password") }),
    }).catch(() => null);
    setPending(false);

    if (response?.status === 204) return setDone(true);
    const code = (await response?.json().catch(() => null))?.error;
    setError(t(`reset.errors.${ERRORS.find((known) => known === code) ?? "INTERNAL_ERROR"}`));
  }

  if (token === null) return null;
  if (done || !token) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-center text-body-md ${done ? "bg-accent/10 text-ink" : "bg-surface-muted text-ink-soft"}`}
        >
          {done ? t("reset.success") : t("reset.invalidLink")}
        </p>
        <Link href={done ? "/login" : "/login?view=forgot"} className={buttonClassName("md", "w-full")}>
          {done ? t("reset.toLogin") : t("reset.newLink")}
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="reset-password" label={t("reset.newPassword")}>
        <PasswordInput
          id="reset-password"
          name="password"
          autoComplete="new-password"
          placeholder={t("fields.passwordPlaceholder")}
          minLength={8}
          maxLength={72}
          required
        />
      </Field>

      <Field id="reset-confirm-password" label={t("fields.confirmPassword")}>
        <PasswordInput
          id="reset-confirm-password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder={t("fields.passwordPlaceholder")}
          required
        />
      </Field>

      <FormError>{error}</FormError>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t("reset.saving") : t("reset.submit")}
      </Button>
    </form>
  );
}

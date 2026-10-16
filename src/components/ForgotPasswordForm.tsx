"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";

const ERRORS = ["INVALID_INPUT", "TOO_MANY_REQUESTS", "MAIL_UNAVAILABLE"] as const;

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setError(null);

    const response = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setPending(false);

    // 202 que le compte existe ou non : le message ne dit jamais s'il y a un compte.
    if (response?.status === 202) return setSent(true);
    const code = (await response?.json().catch(() => null))?.error;
    setError(t(`forgot.errors.${ERRORS.find((known) => known === code) ?? "INTERNAL_ERROR"}`));
  }

  if (sent) {
    return (
      <p role="status" className="rounded-lg bg-accent/10 px-4 py-3 text-center text-body-md text-ink">
        {t("forgot.sent")}
      </p>
    );
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="forgot-email" label={t("fields.email")}>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("fields.emailPlaceholder")}
          required
        />
      </Field>

      <FormError>{error}</FormError>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t("forgot.sending") : t("forgot.submit")}
      </Button>
    </form>
  );
}

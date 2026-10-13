"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Interface seule : l'envoi du lien de réinitialisation sera branché à une étape suivante.
    event.preventDefault();
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

      <Button type="submit" className="mt-1 w-full">
        {t("forgot.submit")}
      </Button>
    </form>
  );
}

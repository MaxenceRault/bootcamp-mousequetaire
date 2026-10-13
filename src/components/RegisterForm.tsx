"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function RegisterForm() {
  const t = useTranslations("Auth");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Interface seule : l'appel à l'API d'inscription sera branché à une étape suivante.
    event.preventDefault();
  }

  return (
    // method="post" : si le JS n'est pas encore chargé, le mot de passe ne part jamais dans l'URL.
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="register-name" label={t("fields.name")}>
        <Input id="register-name" name="name" type="text" autoComplete="name" required />
      </Field>

      <Field id="register-email" label={t("fields.email")}>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("fields.emailPlaceholder")}
          required
        />
      </Field>

      <Field id="register-password" label={t("fields.password")}>
        <PasswordInput
          id="register-password"
          name="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field id="register-confirm-password" label={t("fields.confirmPassword")}>
        <PasswordInput
          id="register-confirm-password"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" className="mt-1 w-full">
        {t("register.submit")}
      </Button>
    </form>
  );
}

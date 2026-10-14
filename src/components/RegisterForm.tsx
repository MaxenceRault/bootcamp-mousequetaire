"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { authErrorCode, postAuth, saveSession } from "@/lib/session";

export function RegisterForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (form.get("password") !== form.get("confirmPassword")) {
      return setError(t("errors.PASSWORD_MISMATCH"));
    }

    setPending(true);
    setError(null);
    const result = await postAuth("/api/v1/auth/register", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    setPending(false);

    if ("error" in result) return setError(t(`errors.${authErrorCode(result.error)}`));
    saveSession(result.token, result.refreshToken, result.user, false);
    router.push("/");
  }

  return (
    // method="post" : sans JS chargé, le mot de passe ne part jamais dans l'URL.
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="register-name" label={t("fields.name")}>
        <Input
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder={t("fields.namePlaceholder")}
          required
        />
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
          placeholder={t("fields.passwordPlaceholder")}
          minLength={8}
          maxLength={72}
          required
        />
      </Field>

      <Field id="register-confirm-password" label={t("fields.confirmPassword")}>
        <PasswordInput
          id="register-confirm-password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder={t("fields.passwordPlaceholder")}
          required
        />
      </Field>

      <FormError>{error}</FormError>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {t("register.submit")}
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { postAuth, saveSession } from "@/lib/session";

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const remember = form.get("remember") === "on";

    setPending(true);
    setError(null);
    const result = await postAuth("/api/v1/auth/login", {
      email: form.get("email"),
      password: form.get("password"),
      remember,
    });
    setPending(false);

    if ("error" in result) return setError(t(`errors.${result.error}`));
    saveSession(result.token, result.refreshToken, result.user, remember);
    router.push("/");
  }

  return (
    // method="post" : si le JS n'est pas encore chargé, le mot de passe ne part jamais dans l'URL.
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="login-email" label={t("fields.email")}>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("fields.emailPlaceholder")}
          required
        />
      </Field>

      <Field
        id="login-password"
        label={t("fields.password")}
        aside={
          <Link
            href="/login?view=forgot"
            className="font-display text-label-md text-ink-soft transition hover:text-ink"
          >
            {t("login.forgot")}
          </Link>
        }
      >
        <PasswordInput
          id="login-password"
          name="password"
          autoComplete="current-password"
          placeholder={t("fields.passwordPlaceholder")}
          required
        />
      </Field>

      <Checkbox name="remember" className="pt-1">
        {t("login.remember")}
      </Checkbox>

      <FormError>{error}</FormError>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {t("login.submit")}
      </Button>
    </form>
  );
}

"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const t = useTranslations("PasswordInput");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={`pr-11 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hide") : t("show")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-soft transition hover:text-ink focus-visible:text-ink focus-visible:outline-none"
      >
        <Icon name={visible ? "visibilityOff" : "visibility"} className="size-5" />
      </button>
    </div>
  );
}

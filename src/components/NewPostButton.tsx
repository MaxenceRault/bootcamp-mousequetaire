"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getSessionSnapshot, subscribeSession } from "@/lib/session";

// Bouton flottant « Nouveau post » : réservé aux utilisateurs connectés (masqué pour un visiteur).
export function NewPostButton() {
  const t = useTranslations("Home");
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
  if (!session) return null;

  return (
    <Link
      href="/post/new"
      aria-label={t("newPost")}
      className={buttonClassName("md", "group fixed right-4 bottom-4 z-50 gap-0 px-3.5 shadow-lg md:right-6 md:bottom-6")}
    >
      <Icon name="add" className="size-5" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-xs group-focus-visible:ml-2 group-focus-visible:max-w-xs">
        {t("newPost")}
      </span>
    </Link>
  );
}

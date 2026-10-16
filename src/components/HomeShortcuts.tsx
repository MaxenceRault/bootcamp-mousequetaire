"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { sidebarLinkClassName } from "@/components/HomeSidebar";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getSessionSnapshot, subscribeSession } from "@/client/session";

// Raccourcis de la colonne de gauche : réservés aux connectés, comme le bouton « Nouveau post ».
// « Nouveau récit » : bouton principal (action principale de l'accueil) ; « Planifier » reste un lien.
export function HomeShortcuts() {
  const t = useTranslations("HomeSidebar");
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
  if (!session) return null;

  return (
    <nav aria-label={t("shortcutsLabel")} className="border-t border-line pt-3">
      <ul className="flex flex-col gap-1">
        <li className="mb-1">
          <Link href="/post/new" className={buttonClassName("md", "w-full gap-3")}>
            <Icon name="add" className="size-5" />
            {t("newPost")}
          </Link>
        </li>
        <li>
          <Link href="/planner" className={sidebarLinkClassName()}>
            <Icon name="calendar" className="size-5" />
            {t("plan")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

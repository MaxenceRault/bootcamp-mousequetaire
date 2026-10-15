"use client";

import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { NavbarLinks } from "@/components/NavbarLinks";
import { Icon } from "@/components/ui/Icon";
import { useDismiss } from "@/lib/useDismiss";

// Menu burger (< md) : recherche et liens principaux, masqués dans la barre sur petit écran.
export function NavbarMobileMenu({ search }: { search: ReactNode }) {
  const t = useTranslations("Navbar");
  const pathname = usePathname();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  // Ouvert seulement sur la page où il a été ouvert : un changement de page le ferme.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = useCallback(() => setOpenedOn(null), []);
  useDismiss(root, open, close);

  return (
    <div ref={root} className="md:hidden">
      <button
        type="button"
        onClick={() => setOpenedOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        className="flex size-10 items-center justify-center rounded-lg text-ink transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
      >
        <Icon name={open ? "close" : "menu"} className="size-6" />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full flex flex-col gap-3 border-b border-line bg-surface px-4 pt-3 pb-4 shadow-lg"
        >
          {search}
          <nav aria-label={t("mainNav")} className="flex flex-col gap-1">
            <NavbarLinks variant="stacked" />
          </nav>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { NavbarAccount } from "@/components/NavbarAccount";

// Barre du haut. La zone compte (visiteur / connecté) dépend de la session du navigateur : voir NavbarAccount.
export async function Navbar() {
  const t = await getTranslations("Navbar");

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-300 items-center justify-between gap-4 px-4 md:gap-6 md:px-6">
        <Link href="/" aria-label={t("home")} className="group flex shrink-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-on-accent transition group-hover:scale-105">
            <Icon name="explore" className="size-5" />
          </span>
          <span className="font-display text-headline-sm text-ink">{t("brand")}</span>
        </Link>

        {/* Interface seule : la recherche IA sera branchée avec le chat RAG. */}
        <div role="search" className="mx-auto hidden max-w-xl flex-1 sm:block">
          <div className="flex items-center rounded-lg border border-transparent bg-surface-muted p-1.5 transition focus-within:border-accent focus-within:bg-surface">
            <Icon name="search" className="ml-2 size-4.5 text-ink-soft" />
            <input
              type="search"
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              maxLength={200}
              className="w-full bg-transparent px-2 py-1 text-body-sm text-ink outline-none placeholder:text-ink-soft/60"
            />
            <button type="button" className={buttonClassName("sm", "h-8 shrink-0")}>
              <Icon name="sparkles" className="size-4" />
              {t("askAi")}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <nav aria-label={t("mainNav")} className="hidden items-center gap-5 md:flex">
            <Link href="/" aria-current="page" className="font-display text-label-lg text-ink transition hover:text-accent">
              {t("explore")}
            </Link>
            <Link href="/planner" className="font-display text-label-lg text-ink-soft transition hover:text-accent">
              {t("plan")}
            </Link>
          </nav>

          <NavbarAccount />
        </div>
      </div>
    </header>
  );
}


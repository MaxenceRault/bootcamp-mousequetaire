import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { NavbarAccount } from "@/components/NavbarAccount";

// Barre du haut. La zone compte (visiteur / connecté) dépend de la session du navigateur : voir NavbarAccount.
export async function Navbar() {
  const t = await getTranslations("Navbar");

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-300 items-center justify-between gap-4 px-4 md:gap-6 md:px-6">
        <Link href="/" aria-label={t("home")} className="group flex shrink-0 items-center gap-2.5">
          <Logo className="size-9 transition group-hover:scale-105" />
          <span className="font-display text-headline-sm text-ink">{t("brand")}</span>
        </Link>

        {/* Interface seule : la recherche IA sera branchée avec le chat RAG. */}
        {/* Recherche : envoie vers l'accueil (/?q=…), qui affiche les récits classés par pertinence. */}
        <form role="search" action="/" method="get" className="mx-auto hidden max-w-xl flex-1 sm:block">
          <div className="flex items-center rounded-lg border border-transparent bg-surface-muted p-1.5 transition focus-within:border-accent focus-within:bg-surface">
            <Icon name="search" className="ml-2 size-4.5 text-ink-soft" />
            <input
              type="search"
              name="q"
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              minLength={2}
              maxLength={100}
              required
              className="w-full bg-transparent px-2 py-1 text-body-sm text-ink outline-none placeholder:text-ink-soft/60"
            />
            <button type="submit" className={buttonClassName("sm", "h-8 shrink-0")}>
              <Icon name="search" className="size-4" />
              {t("search")}
            </button>
          </div>
        </form>

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


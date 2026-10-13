import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export type NavbarUser = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

// Barre du haut. Visiteur : bouton « Se connecter ». Connecté : avatar + menu du compte.
export async function Navbar({ user }: { user: NavbarUser | null }) {
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

          {user ? <AccountMenu user={user} /> : (
            <Link href="/login" className={buttonClassName("sm")}>
              {t("login")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// Menu déroulant du compte : s'ouvre au survol ou au focus clavier (sans JavaScript).
async function AccountMenu({ user }: { user: NavbarUser }) {
  const t = await getTranslations("Navbar");

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={t("accountMenu")}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
      >
        <Avatar src={user.avatarUrl} alt="" size={28} />
        <Icon name="chevronDown" className="size-4 text-ink-soft" />
      </button>

      <div className="absolute top-full right-0 z-50 hidden w-48 pt-1.5 group-focus-within:block group-hover:block">
        <div className="rounded-lg border border-line bg-surface py-1.5 shadow-lg">
          <div className="mb-1 border-b border-line px-3 py-1.5">
            <p className="font-display text-label-lg text-ink">{user.displayName}</p>
            <p className="text-body-sm text-ink-soft/70">@{user.username}</p>
          </div>
          <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-body-md text-ink-soft transition hover:bg-canvas hover:text-ink">
            <Icon name="bookmark" className="size-4" />
            {t("savedTrips")}
          </Link>
          <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-body-md text-ink-soft transition hover:bg-canvas hover:text-ink">
            <Icon name="settings" className="size-4" />
            {t("settings")}
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  getSessionSnapshot,
  logout,
  parseSessionUser,
  subscribeSession,
  type SessionUser,
} from "@/lib/session";

// Zone compte de la Navbar. Visiteur : bouton « Se connecter ». Connecté (token valide) : avatar + menu.
// La session est stockée dans le navigateur : côté serveur, on ne sait pas encore → emplacement réservé.
export function NavbarAccount() {
  const t = useTranslations("Navbar");
  const snapshot = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => undefined);

  if (snapshot === undefined) {
    return <span aria-hidden="true" className="block h-9 w-28" />;
  }

  const user = parseSessionUser(snapshot);
  if (!user) {
    return (
      <Link href="/login" className={buttonClassName("sm")}>
        {t("login")}
      </Link>
    );
  }

  return <AccountMenu user={user} />;
}

// Menu déroulant du compte : s'ouvre au survol ou au focus clavier.
function AccountMenu({ user }: { user: SessionUser }) {
  const t = useTranslations("Navbar");
  const router = useRouter();

  // Révoque la session côté serveur et efface les tokens : la Navbar repasse en visiteur via l'événement de session.
  function handleLogout() {
    void logout();
    router.push("/");
  }

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={t("accountMenu")}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
      >
        <Avatar src={user.avatar_url} name={user.avatar_seed ?? user.id}
          backgroundColor={user.avatar_background_color} alt="" size={28} />
        <Icon name="chevronDown" className="size-4 text-ink-soft" />
      </button>

      <div className="absolute top-full right-0 z-50 hidden w-48 pt-1.5 group-focus-within:block group-hover:block">
        <div className="rounded-lg border border-line bg-surface py-1.5 shadow-lg">
          <div className="mb-1 border-b border-line px-3 py-1.5">
            <p className="font-display text-label-lg text-ink">{user.display_name}</p>
            <p className="text-body-sm text-ink-soft/70">@{user.username}</p>
          </div>
          <Link href="/profile?tab=saved" className="flex items-center gap-2 px-3 py-2 text-body-md text-ink-soft transition hover:bg-canvas hover:text-ink">
            <Icon name="bookmark" className="size-4" />
            {t("savedTrips")}
          </Link>
          <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-body-md text-ink-soft transition hover:bg-canvas hover:text-ink">
            <Icon name="settings" className="size-4" />
            {t("settings")}
          </Link>
          <div className="mt-1 border-t border-line pt-1">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-md text-ink-soft transition hover:bg-canvas hover:text-ink"
            >
              <Icon name="logout" className="size-4" />
              {t("logout")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

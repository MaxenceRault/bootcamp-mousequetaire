import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

// Adresse du profil public d'un utilisateur.
export const profileHref = (username: string) => `/profile/${username}`;

// Avatar cliquable vers le profil public (fil d'actualité, page d'un récit).
// L'avatar seul n'a pas de texte : le lien porte un nom accessible (« Voir le profil de … »).
export function ProfileAvatarLink({ username, name, children }: { username: string; name: string; children: ReactNode }) {
  const t = useTranslations("ProfileLink");

  return (
    <Link
      href={profileHref(username)}
      aria-label={t("avatarLabel", { name })}
      className="shrink-0 rounded-lg transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-accent/25 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

// Nom de l'auteur cliquable vers son profil public.
export function ProfileNameLink({ username, children }: { username: string; children: ReactNode }) {
  return (
    <Link href={profileHref(username)} className="transition hover:text-accent">
      {children}
    </Link>
  );
}

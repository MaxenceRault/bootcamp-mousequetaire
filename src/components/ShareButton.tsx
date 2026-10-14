"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Partage du lien de la page : menu de partage natif (mobile), sinon copie dans le presse-papiers.
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("Post");
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      // Annulation par l'utilisateur : rien à faire.
      await navigator.share({ title, url }).catch(() => {});
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé par le navigateur : pas de retour visuel.
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleShare}>
      <Icon name={copied ? "check" : "share"} className="size-4" />
      <span aria-live="polite">{copied ? t("linkCopied") : t("share")}</span>
    </Button>
  );
}

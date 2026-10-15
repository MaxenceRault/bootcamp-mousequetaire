"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { FEED_ANCHOR_ID } from "@/lib/posts";

// Lien de filtre du feed (type de récit) : ne remonte pas en haut de la page comme un Link classique.
// On reste en place si le début du feed est visible, sinon on revient au début du feed (pas au hero).
export function FeedFilterLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    // Ouverture dans un nouvel onglet (Cmd / Ctrl / clic du milieu) : la page actuelle ne bouge pas.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const feed = document.getElementById(FEED_ANCHOR_ID);
    if (!feed) return;
    // scroll-margin-top du feed : hauteur de la barre de navigation fixe.
    const offset = parseFloat(getComputedStyle(feed).scrollMarginTop) || 0;
    if (feed.getBoundingClientRect().top >= offset) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    feed.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }

  return <Link {...props} scroll={false} onClick={handleClick} />;
}

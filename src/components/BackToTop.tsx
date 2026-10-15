"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Apparaît après environ un écran de défilement.
const SHOW_AFTER_PX = 800;

// Desktop uniquement : sur mobile, le geste natif (tap sur la barre d'état) fait déjà remonter.
export function BackToTop() {
  const t = useTranslations("BackToTop");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (!visible) return null;
  return (
    <div className="hidden lg:block">
      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t("label")}
        title={t("label")}
        className={buttonClassName("md", "w-12 px-0 shadow-lg md:w-11", "secondary")}
      >
        <Icon name="arrowUp" className="size-5" />
      </button>
    </div>
  );
}

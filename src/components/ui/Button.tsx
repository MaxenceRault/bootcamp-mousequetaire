import type { ComponentProps } from "react";

// Bouton principal du design system : accent, 8px d'arrondi, 48px de haut sur mobile / 44px desktop.
export function Button({ className = "", type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={`inline-flex h-12 items-center justify-center rounded-lg bg-accent px-4 font-display text-label-lg text-on-accent transition hover:opacity-92 focus-visible:ring-4 focus-visible:ring-accent/25 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 md:h-11 ${className}`}
      {...props}
    />
  );
}

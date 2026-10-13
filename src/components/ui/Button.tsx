import type { ComponentProps } from "react";

type ButtonSize = "md" | "sm";

const SIZES: Record<ButtonSize, string> = {
  // 48px de haut sur mobile / 44px desktop (formulaires).
  md: "h-12 px-4 text-label-lg md:h-11",
  // Bouton compact (navbar, cartes du feed).
  sm: "h-9 gap-1.5 px-3.5 text-label-md",
};

// Classes du bouton principal du design system : accent, 8px d'arrondi.
// Exportées pour styler un <Link> comme un bouton.
export function buttonClassName(size: ButtonSize = "md", className = "") {
  return `inline-flex items-center justify-center rounded-lg bg-accent font-display text-on-accent transition hover:opacity-92 focus-visible:ring-4 focus-visible:ring-accent/25 focus-visible:outline-none active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[size]} ${className}`;
}

type ButtonProps = ComponentProps<"button"> & { size?: ButtonSize };

export function Button({ className = "", type = "button", size = "md", ...props }: ButtonProps) {
  return <button type={type} className={buttonClassName(size, className)} {...props} />;
}

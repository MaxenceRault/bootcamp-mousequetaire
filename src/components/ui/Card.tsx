import type { ComponentProps } from "react";

// Surface du design system : fond blanc, bordure fine, 8px d'arrondi. Le padding est laissé à l'appelant.
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-lg border border-line bg-surface ${className}`} {...props} />;
}

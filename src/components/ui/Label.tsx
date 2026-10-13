import type { ComponentProps } from "react";

// Label de champ : Space Grotesk, style label-md.
export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return <label className={`font-display text-label-md text-ink ${className}`} {...props} />;
}

import type { ComponentProps } from "react";

export function Label({ className = "", ...props }: ComponentProps<"label">) {
  return <label className={`font-display text-label-md text-ink ${className}`} {...props} />;
}

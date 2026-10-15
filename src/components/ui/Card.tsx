import type { ComponentProps } from "react";

// Le padding est laissé à l'appelant.
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-lg border border-line bg-surface ${className}`} {...props} />;
}

import type { ComponentProps } from "react";

type BadgeTone = "neutral" | "accent" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-ink-soft",
  accent: "bg-accent/10 text-accent",
  danger: "bg-error/10 text-error",
};

export function Badge({ tone = "neutral", className = "", ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-label-sm whitespace-nowrap ${TONES[tone]} ${className}`}
      {...props}
    />
  );
}

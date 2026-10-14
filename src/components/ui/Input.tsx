import type { ComponentProps } from "react";

// Style commun aux champs de saisie (Input, Textarea) : fond gris clair au repos,
// blanc + bordure foncée + anneau accent au focus.
export const FIELD_CLASS_NAME =
  "w-full rounded-lg border border-transparent bg-surface-muted px-4 text-body-md text-ink transition placeholder:text-ink-soft/50 focus:border-ink focus:bg-surface focus:ring-2 focus:ring-accent/25 focus:outline-none";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`h-11 ${FIELD_CLASS_NAME} ${className}`} {...props} />;
}

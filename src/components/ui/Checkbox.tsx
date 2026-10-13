import type { ComponentProps, ReactNode } from "react";

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & { children: ReactNode };

// Case à cocher native (accessible au clavier), 18px, cochée en couleur d'accent.
export function Checkbox({ className = "", children, ...props }: CheckboxProps) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 select-none ${className}`}>
      <input type="checkbox" className="size-4.5 cursor-pointer accent-accent" {...props} />
      <span className="text-body-sm text-ink-soft">{children}</span>
    </label>
  );
}

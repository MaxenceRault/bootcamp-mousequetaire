"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui/IconButton";

// Fenêtre modale : <dialog> natif (focus piégé, Échap, fond inerte). Fermée aussi par un clic sur le fond.
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-lg bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-headline-sm text-ink">
            {title}
          </h2>
          <IconButton icon="close" label={closeLabel} onClick={onClose} />
        </div>
        {children}
      </div>
    </dialog>
  );
}

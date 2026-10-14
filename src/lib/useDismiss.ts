"use client";

import { useEffect, type RefObject } from "react";

// Ferme un menu ouvert au clic en dehors de `ref` ou avec Échap.
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function handlePointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ref, open, onClose]);
}

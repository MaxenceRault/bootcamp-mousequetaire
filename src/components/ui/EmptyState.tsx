import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

// Message d'une liste vide (ex. « Aucun récit pour l'instant »), centré dans une carte.
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center text-body-md text-ink-soft">{children}</Card>
  );
}

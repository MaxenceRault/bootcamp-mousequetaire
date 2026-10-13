import type { ReactNode } from "react";
import { Label } from "@/components/ui/Label";

type FieldProps = {
  id: string;
  label: string;
  // Élément optionnel aligné à droite du label (ex. lien « Mot de passe oublié ? »).
  aside?: ReactNode;
  children: ReactNode;
};

// Bloc label + champ de formulaire.
export function Field({ id, label, aside, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
    </div>
  );
}

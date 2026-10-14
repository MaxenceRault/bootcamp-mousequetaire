import type { ReactNode } from "react";
import { Label } from "@/components/ui/Label";

type FieldProps = {
  id: string;
  label: string;
  aside?: ReactNode;
  children: ReactNode;
};

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

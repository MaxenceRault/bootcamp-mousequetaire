import type { ComponentProps } from "react";
import { FIELD_CLASS_NAME } from "@/components/ui/Input";

// Hauteur qui suit le contenu ; minimum réglable via className.
export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`field-sizing-content resize-none py-3 ${FIELD_CLASS_NAME} ${className}`}
      {...props}
    />
  );
}

import type { ComponentProps } from "react";
import { FIELD_CLASS_NAME } from "@/components/ui/Input";

// Zone de texte multiligne, même style que Input. Sa hauteur suit le contenu (field-sizing) ;
// la hauteur minimale se règle via className (ex. min-h-24).
export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`field-sizing-content resize-none py-3 ${FIELD_CLASS_NAME} ${className}`}
      {...props}
    />
  );
}

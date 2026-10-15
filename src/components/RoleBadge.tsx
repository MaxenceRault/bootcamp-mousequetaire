import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import type { UserRole } from "@/lib/roles";

// « Voyageur » (par défaut) n'est affiché qu'avec showDefault.
export function RoleBadge({ role, showDefault = false }: { role: UserRole | undefined; showDefault?: boolean }) {
  const t = useTranslations("Roles");
  if (!role || (role === "traveler" && !showDefault)) return null;
  return <Badge tone={role === "admin" || role === "patron" ? "accent" : "neutral"}>{t(role)}</Badge>;
}

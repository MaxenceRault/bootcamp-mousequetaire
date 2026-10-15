import { Icon, type IconName } from "@/components/ui/Icon";

// Bouton carré avec seulement une icône : le libellé sert au lecteur d'écran et à l'infobulle.
export function IconButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
    >
      <Icon name={icon} className="size-4" />
    </button>
  );
}

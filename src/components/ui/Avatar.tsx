import Image from "next/image";

type AvatarProps = {
  src: string | null;
  alt: string;
  // Taille en pixels (carré).
  size: number;
};

// Photo de profil carrée, 8px d'arrondi. Sans photo : carré neutre.
export function Avatar({ src, alt, size }: AvatarProps) {
  if (!src) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className="block shrink-0 rounded-lg bg-surface-muted"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      // Taille forcée en CSS : sinon le reset de Tailwind (height: auto) garde le ratio de la photo d'origine.
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg object-cover ring-1 ring-line"
    />
  );
}

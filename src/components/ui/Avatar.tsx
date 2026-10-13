import Image from "next/image";
import { Blobatar } from "@blobatar/react";

type AvatarProps = {
  src: string | null;
  // Identifiant stable de l'utilisateur (pseudo) : sans photo, il génère toujours le même blobatar.
  name: string;
  alt: string;
  // Taille en pixels (carré).
  size: number;
};

// Photo de profil carrée, 8px d'arrondi. Sans photo : blobatar généré à partir du pseudo.
export function Avatar({ src, name, alt, size }: AvatarProps) {
  if (!src) {
    return (
      <Blobatar
        name={name}
        size={size}
        alt={alt}
        className="shrink-0 rounded-lg bg-surface-muted ring-1 ring-line"
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

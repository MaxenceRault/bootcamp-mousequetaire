import Image from "next/image";
import { Blobatar } from "@blobatar/react";

type AvatarProps = {
  src: string | null;
  // Identifiant stable de l'utilisateur (son id) : sans photo, il génère toujours le même blobatar,
  // même si l'utilisateur change de pseudo.
  name: string;
  alt: string;
  // Taille en pixels (carré).
  size: number;
  // Couleur de fond choisie par l'utilisateur derrière le blobatar (sinon fond neutre).
  backgroundColor?: string | null;
};

// Photo de profil carrée, 8px d'arrondi. Sans photo : blobatar généré à partir de l'id,
// posé sur la couleur de fond choisie par l'utilisateur (sinon sur un fond neutre).
export function Avatar({ src, name, alt, size, backgroundColor = null }: AvatarProps) {
  if (!src) {
    return (
      <span
        style={{
          width: size,
          height: size,
          backgroundColor: backgroundColor ?? undefined,
        }}
        className="block shrink-0 overflow-hidden rounded-lg bg-surface-muted ring-1 ring-line"
      >
        <Blobatar name={name} size={size} alt={alt} className="block" />
      </span>
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

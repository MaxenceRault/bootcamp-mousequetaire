import Image from "next/image";
import { Blobatar } from "@blobatar/react";

type AvatarProps = {
  src: string | null;
  // Id de l'utilisateur : même blobatar même s'il change de pseudo.
  name: string;
  alt: string;
  size: number;
  backgroundColor?: string | null;
};

// Sans photo : blobatar généré à partir de l'id.
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
      // Sinon le reset de Tailwind (height: auto) garde le ratio de la photo.
      style={{ width: size, height: size }}
      className="shrink-0 rounded-lg object-cover ring-1 ring-line"
    />
  );
}

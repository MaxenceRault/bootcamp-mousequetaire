// Nom de fichier d'un export : « Kyoto : saveurs d'automne » → « kyoto-saveurs-d-automne » (ASCII, sûr dans un en-tête HTTP).
export function exportFileName(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "voyage"
  );
}

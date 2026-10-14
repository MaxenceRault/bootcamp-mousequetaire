import "server-only";

// Type réel lu dans les premiers octets : le type annoncé par le navigateur ne prouve rien.
const IMAGE_SIGNATURES = [
  { extension: "jpg", contentType: "image/jpeg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    extension: "png",
    contentType: "image/png",
    matches: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte),
  },
  {
    extension: "webp",
    contentType: "image/webp",
    matches: (b: Uint8Array) =>
      [0x52, 0x49, 0x46, 0x46].every((byte, i) => b[i] === byte) &&
      [0x57, 0x45, 0x42, 0x50].every((byte, i) => b[i + 8] === byte),
  },
];

export type DetectedImage = { extension: string; contentType: string };

export async function detectImage(file: File): Promise<DetectedImage | null> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const found = IMAGE_SIGNATURES.find((signature) => signature.matches(bytes));
  return found ? { extension: found.extension, contentType: found.contentType } : null;
}

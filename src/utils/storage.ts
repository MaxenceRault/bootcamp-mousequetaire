import "server-only";
import { Storage } from "@google-cloud/storage";

// Même identité IAM que la base : aucune clé dans l'app.

const globalForStorage = globalThis as unknown as { storage?: Storage };

export function getBucket(name: string) {
  globalForStorage.storage ??= new Storage();
  return globalForStorage.storage.bucket(name);
}

export function publicUrl(bucket: string, path: string) {
  return `https://storage.googleapis.com/${bucket}/${path}`;
}

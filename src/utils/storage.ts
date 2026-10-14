import "server-only";
import { Storage } from "@google-cloud/storage";

// Client Cloud Storage : même identité que la base (application-default en local,
// compte de service sur Cloud Run), donc aucune clé dans l'app.

const globalForStorage = globalThis as unknown as { storage?: Storage };

export function getBucket(name: string) {
  globalForStorage.storage ??= new Storage();
  return globalForStorage.storage.bucket(name);
}

export function publicUrl(bucket: string, path: string) {
  return `https://storage.googleapis.com/${bucket}/${path}`;
}

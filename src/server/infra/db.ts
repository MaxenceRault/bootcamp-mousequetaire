import "server-only";
import { AuthTypes, Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { Pool, types } from "pg";
import { getConfig } from "@/server/config";

// Connecteur Cloud SQL : TLS + authentification IAM, aucun mot de passe de base.

const globalForDb = globalThis as unknown as { dbPool?: Promise<Pool> };

async function createPool() {
  const { instanceConnectionName, user, database } = getConfig().db;

  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  });

  return new Pool({ ...clientOpts, user, database, max: 5, types: { getTypeParser } });
}

// Dates en chaînes, sérialisables vers les composants client.
const TIMESTAMPTZ_OID = 1184;
const DATE_OID = 1082;

function getTypeParser(oid: number, format?: "text" | "binary") {
  if (oid === TIMESTAMPTZ_OID) return (value: string) => new Date(value).toISOString();
  if (oid === DATE_OID) return (value: string) => value;
  return types.getTypeParser(oid, format);
}

// Un seul pool par process (survit au rechargement à chaud).
export function getDb() {
  globalForDb.dbPool ??= createPool().catch((error) => {
    globalForDb.dbPool = undefined;
    throw error;
  });
  return globalForDb.dbPool;
}

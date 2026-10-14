import "server-only";
import { AuthTypes, Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { Pool, types } from "pg";

// Connexion à Cloud SQL (Postgres) via le connecteur officiel Google :
// TLS chiffré + authentification IAM, donc aucun mot de passe de base dans l'app.
// En local : identité `gcloud auth application-default login`. Sur Cloud Run : compte de service.

const globalForDb = globalThis as unknown as { dbPool?: Promise<Pool> };

async function createPool() {
  const instanceConnectionName = process.env.CLOUD_SQL_INSTANCE;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  if (!instanceConnectionName || !user || !database) {
    throw new Error("CLOUD_SQL_INSTANCE, DB_USER et DB_NAME doivent être définies");
  }

  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  });

  return new Pool({ ...clientOpts, user, database, max: 5, types: { getTypeParser } });
}

// Dates renvoyées en chaînes (sérialisables vers les composants client) :
// timestamptz en ISO 8601, date en « AAAA-MM-JJ ».
const TIMESTAMPTZ_OID = 1184;
const DATE_OID = 1082;

function getTypeParser(oid: number, format?: "text" | "binary") {
  if (oid === TIMESTAMPTZ_OID) return (value: string) => new Date(value).toISOString();
  if (oid === DATE_OID) return (value: string) => value;
  return types.getTypeParser(oid, format);
}

// Un seul pool par process (réutilisé entre les rechargements à chaud en dev).
export function getDb() {
  globalForDb.dbPool ??= createPool().catch((error) => {
    globalForDb.dbPool = undefined;
    throw error;
  });
  return globalForDb.dbPool;
}

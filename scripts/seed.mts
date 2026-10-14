// Seed manuel : remplit la table users avec des comptes de démo (sans mot de passe : non connectables).
// Lancement : npm run seed
// Relançable sans doublons (ids fixes + upsert).
//
// Se connecte à Cloud SQL avec ton identité Google (gcloud auth application-default login),
// qui doit avoir le rôle brb_admin. Ce script tourne uniquement en local, jamais dans l'app.
//
// Les posts ne sont pas seedés : la table post a changé de format, le seed sera à compléter.

import { AuthTypes, Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";

const { CLOUD_SQL_INSTANCE, DB_USER, DB_NAME } = process.env;

if (!CLOUD_SQL_INSTANCE || !DB_USER || !DB_NAME) {
  console.error("CLOUD_SQL_INSTANCE, DB_USER et DB_NAME doivent être définies dans .env.local");
  process.exit(1);
}

const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=80&fm=jpg`;

const USERS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    username: "wander_elena",
    display_name: "Elena Rostova",
    avatar_url: unsplash("1438761681033-6461ffad8d80"),
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    username: "marco_sophie",
    display_name: "Marco & Sophie",
    avatar_url: unsplash("1507003211169-0a1dd7228f2d"),
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    username: "ines_voyage",
    display_name: "Inès Moreau",
    avatar_url: unsplash("1494790108377-be9c29b29330"),
  },
  {
    id: "00000000-0000-4000-a000-000000000004",
    username: "thomas_trek",
    display_name: "Thomas Lefèvre",
    avatar_url: unsplash("1500648767791-00dcc994a43e"),
  },
  {
    id: "00000000-0000-4000-a000-000000000005",
    username: "mai_eats",
    display_name: "Mai Nguyen",
    avatar_url: unsplash("1534528741775-53994a69daeb"),
  },
];

const connector = new Connector();
const client = new pg.Client({
  ...(await connector.getOptions({
    instanceConnectionName: CLOUD_SQL_INSTANCE,
    ipType: IpAddressTypes.PUBLIC,
    authType: AuthTypes.IAM,
  })),
  user: DB_USER,
  database: DB_NAME,
});

try {
  await client.connect();
  for (const user of USERS) {
    await client.query(
      `insert into users (id, username, display_name, avatar_url)
       values ($1, $2, $3, $4)
       on conflict (id) do update
         set username = excluded.username, display_name = excluded.display_name, avatar_url = excluded.avatar_url`,
      [user.id, user.username, user.display_name, user.avatar_url],
    );
  }
  console.log(`Seed terminé : ${USERS.length} users.`);
} catch (error) {
  console.error("Échec du seed :", (error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
  connector.close();
}

import "server-only";
import { getDb } from "@/utils/db";

// Le quota repart à zéro à minuit, heure de Paris.
const TODAY = "(now() at time zone 'Europe/Paris')::date";

export type AppSettings = { ai_enabled: boolean; ai_daily_cap: number; updated_at: string };

export async function findAppSettings(): Promise<AppSettings> {
  const db = await getDb();
  const { rows } = await db.query<AppSettings>("select ai_enabled, ai_daily_cap, updated_at from app_settings");
  return rows[0];
}

export async function updateAppSettings(changes: Partial<Pick<AppSettings, "ai_enabled" | "ai_daily_cap">>) {
  const db = await getDb();
  const { rows } = await db.query<AppSettings>(
    `update app_settings
     set ai_enabled = coalesce($1, ai_enabled), ai_daily_cap = coalesce($2, ai_daily_cap), updated_at = now()
     returning ai_enabled, ai_daily_cap, updated_at`,
    [changes.ai_enabled ?? null, changes.ai_daily_cap ?? null],
  );
  return rows[0];
}

export async function countAiCallsToday(): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ total: number }>(
    `select coalesce(sum(count), 0)::int as total from ai_usage where day = ${TODAY}`,
  );
  return rows[0].total;
}

export async function countUserAiCallsToday(userId: string): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ count: number }>(
    `select count from ai_usage where user_id = $1 and day = ${TODAY}`,
    [userId],
  );
  return rows[0]?.count ?? 0;
}

// Atomique : deux requêtes simultanées ne peuvent pas dépasser la limite.
export async function incrementAiUsage(userId: string, limit: number | null): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query(
    `insert into ai_usage (user_id, day, count) values ($1, ${TODAY}, 1)
     on conflict (user_id, day) do update set count = ai_usage.count + 1
     where $2::int is null or ai_usage.count < $2`,
    [userId, limit],
  );
  return rowCount === 1;
}

export async function countAiCallsPerDay(days: number): Promise<{ day: string; total: number }[]> {
  const db = await getDb();
  const { rows } = await db.query<{ day: string; total: number }>(
    `select d::date::text as day, coalesce(sum(u.count), 0)::int as total
     from generate_series(${TODAY} - ($1::int - 1), ${TODAY}, interval '1 day') d
     left join ai_usage u on u.day = d::date
     group by d order by d`,
    [days],
  );
  return rows;
}

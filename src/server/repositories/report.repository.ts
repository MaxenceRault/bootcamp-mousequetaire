import "server-only";
import { getDb } from "@/server/infra/db";

// false si cet utilisateur avait déjà signalé ce post.
// Signalement du système (reporter_id null), ex. modération automatique indisponible.
export async function insertSystemReport(postId: number, reason: string) {
  const db = await getDb();
  await db.query("insert into post_report (post_id, reporter_id, reason) values ($1, null, $2)", [postId, reason]);
}

export async function insertReport(postId: number, reporterId: string, reason: string | null): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query(
    `insert into post_report (post_id, reporter_id, reason) values ($1, $2, $3)
     on conflict (post_id, reporter_id) do nothing`,
    [postId, reporterId, reason],
  );
  return rowCount === 1;
}

export type ReportedPostRow = {
  post_id: number;
  title: string;
  slug: string;
  is_hidden: boolean;
  author: { id: string; username: string; display_name: string };
  report_count: number;
  last_reported_at: string;
  // reporter null : signalement du système.
  reasons: { reason: string | null; reporter: string | null; created_at: string }[];
};

export async function findOpenReports(limit: number): Promise<ReportedPostRow[]> {
  const db = await getDb();
  const { rows } = await db.query<ReportedPostRow>(
    `select p.id as post_id, p.title, p.slug, p.is_hidden,
       json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name) as author,
       count(*)::int as report_count,
       max(r.created_at) as last_reported_at,
       (select json_agg(x) from (
          select r2.reason, ru.username as reporter, r2.created_at
          from post_report r2 left join users ru on ru.id = r2.reporter_id
          where r2.post_id = p.id and r2.status = 'open'
          order by r2.created_at desc limit 10
        ) x) as reasons
     from post_report r
     join post p on p.id = r.post_id
     join users u on u.id = p.author_id
     where r.status = 'open'
     group by p.id, u.id
     order by count(*) desc, max(r.created_at) desc
     limit $1`,
    [limit],
  );
  return rows;
}

// « dismissed » : rien à reprocher ; « resolved » : post masqué.
export async function closeOpenReports(postId: number, status: "dismissed" | "resolved"): Promise<number> {
  const db = await getDb();
  const { rowCount } = await db.query(
    "update post_report set status = $2, resolved_at = now() where post_id = $1 and status = 'open'",
    [postId, status],
  );
  return rowCount ?? 0;
}

export async function countOpenReports(): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ total: number }>(
    "select count(distinct post_id)::int as total from post_report where status = 'open'",
  );
  return rows[0].total;
}

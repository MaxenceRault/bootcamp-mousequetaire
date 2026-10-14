import "server-only";
import type { UserRole } from "@/lib/roles";
import { getDb } from "@/utils/db";

export type CommentRow = {
  id: number;
  content: string;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    avatar_seed: string | null;
    avatar_background_color: string | null;
    role: UserRole;
  };
};

const COMMENT_SELECT = `select c.id, c.content, c.created_at,
    json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url,
      'avatar_seed', u.avatar_seed, 'avatar_background_color', u.avatar_background_color, 'role', u.role) as author
  from post_comment c join users u on u.id = c.author_id`;

export async function findCommentsByPost(postId: number, limit: number): Promise<CommentRow[]> {
  const db = await getDb();
  const { rows } = await db.query<CommentRow>(`${COMMENT_SELECT} where c.post_id = $1 order by c.id limit $2`, [postId, limit]);
  return rows;
}

export async function insertComment(postId: number, authorId: string, content: string): Promise<CommentRow> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    "insert into post_comment (post_id, author_id, content) values ($1, $2, $3) returning id",
    [postId, authorId, content],
  );
  const created = await db.query<CommentRow>(`${COMMENT_SELECT} where c.id = $1`, [rows[0].id]);
  return created.rows[0];
}

export async function findCommentAuthor(postId: number, commentId: number): Promise<string | null> {
  const db = await getDb();
  const { rows } = await db.query<{ author_id: string }>(
    "select author_id from post_comment where id = $1 and post_id = $2",
    [commentId, postId],
  );
  return rows[0]?.author_id ?? null;
}

export async function deleteComment(commentId: number): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("delete from post_comment where id = $1", [commentId]);
  return rowCount === 1;
}

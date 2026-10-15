import "server-only";
import { DatabaseError } from "pg";
import type { BannedTerm } from "@/server/moderationFilter";
import { getDb } from "@/server/infra/db";

export type BannedWordRow = BannedTerm & { id: number; created_at: string };

export class BannedWordTakenError extends Error {
  constructor() {
    super("banned_word_taken");
  }
}

export async function findBannedWords(): Promise<BannedWordRow[]> {
  const db = await getDb();
  const { rows } = await db.query<BannedWordRow>("select id, term, reason, kind, created_at from banned_word order by term");
  return rows;
}

export async function insertBannedWord(word: BannedTerm): Promise<BannedWordRow> {
  const db = await getDb();
  try {
    const { rows } = await db.query<BannedWordRow>(
      "insert into banned_word (term, reason, kind) values ($1, $2, $3) returning id, term, reason, kind, created_at",
      [word.term, word.reason, word.kind],
    );
    return rows[0];
  } catch (error) {
    if (error instanceof DatabaseError && error.code === "23505") throw new BannedWordTakenError();
    throw error;
  }
}

// Renvoie le terme supprimé (pour le journal), null s'il n'existait pas.
export async function deleteBannedWord(id: number): Promise<string | null> {
  const db = await getDb();
  const { rows } = await db.query<{ term: string }>("delete from banned_word where id = $1 returning term", [id]);
  return rows[0]?.term ?? null;
}

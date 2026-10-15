import { z } from "zod";

export const COMMENT_MAX = 1000;

// POST /api/v1/posts/{id}/comments
export const createCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(COMMENT_MAX),
    // Réponse à un commentaire de premier niveau (absent : nouveau fil).
    parentId: z.number().int().positive().max(2_147_483_647).optional(),
  })
  .strict();

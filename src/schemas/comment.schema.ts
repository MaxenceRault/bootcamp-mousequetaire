import { z } from "zod";

export const COMMENT_MAX = 1000;

// POST /api/v1/posts/{id}/comments
export const createCommentSchema = z
  .object({
    content: z.string().trim().min(1).max(COMMENT_MAX),
  })
  .strict();

import { createCommentController, listCommentsController } from "@/lib/controllers/comment.controller";

export const GET = listCommentsController;
export const POST = createCommentController;

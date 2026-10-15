import { createCommentController, listCommentsController } from "@/server/controllers/comment.controller";

export const GET = listCommentsController;
export const POST = createCommentController;

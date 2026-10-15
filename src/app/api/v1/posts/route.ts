import { createPostController, getFeedController } from "@/server/controllers/post.controller";

export const GET = getFeedController;
export const POST = createPostController;

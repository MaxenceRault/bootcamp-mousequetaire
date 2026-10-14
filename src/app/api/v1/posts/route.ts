import { createPostController, getFeedController } from "@/lib/controllers/post.controller";

export const GET = getFeedController;
export const POST = createPostController;

import { reactionController } from "@/server/controllers/reaction.controller";

export const PUT = reactionController("like", true);
export const DELETE = reactionController("like", false);

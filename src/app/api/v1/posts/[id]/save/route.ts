import { reactionController } from "@/server/controllers/reaction.controller";

export const PUT = reactionController("save", true);
export const DELETE = reactionController("save", false);

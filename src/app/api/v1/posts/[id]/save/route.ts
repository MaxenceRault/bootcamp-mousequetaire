import { reactionController } from "@/lib/controllers/reaction.controller";

export const PUT = reactionController("save", true);
export const DELETE = reactionController("save", false);

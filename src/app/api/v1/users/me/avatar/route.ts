import { avatarController } from "@/lib/controllers/user.controller";

export const PUT = avatarController(true);
export const DELETE = avatarController(false);

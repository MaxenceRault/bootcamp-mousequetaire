import { createBannedWordController, listBannedWordsController } from "@/server/controllers/admin.controller";

export const GET = listBannedWordsController;
export const POST = createBannedWordController;

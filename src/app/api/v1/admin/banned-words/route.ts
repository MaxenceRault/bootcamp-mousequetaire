import { createBannedWordController, listBannedWordsController } from "@/lib/controllers/admin.controller";

export const GET = listBannedWordsController;
export const POST = createBannedWordController;

import { createArchetypeController, listArchetypesController } from "@/server/controllers/admin.controller";

export const GET = listArchetypesController;
export const POST = createArchetypeController;

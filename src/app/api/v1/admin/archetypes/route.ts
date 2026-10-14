import { createArchetypeController, listArchetypesController } from "@/lib/controllers/admin.controller";

export const GET = listArchetypesController;
export const POST = createArchetypeController;

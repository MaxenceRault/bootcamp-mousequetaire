import { createExpenseController, getLedgerController } from "@/server/controllers/trip-expense.controller";

export const GET = getLedgerController;
export const POST = createExpenseController;

import "server-only";
import { getExchangeRate } from "@/server/infra/exchangeRates";
import { findTripById } from "@/server/repositories/trip.repository";
import {
  deleteExpense as deleteExpenseRow,
  deleteGuest,
  deletePaymentTask as deletePaymentTaskRow,
  ensureAccountParticipants,
  findExpense,
  findExpenses,
  findParticipants,
  findPaymentTask,
  findPaymentTasks,
  findTripCurrency,
  insertExpense,
  insertGuest,
  insertPaymentTask,
  replaceExpense,
  updateGuestName,
  updatePaymentTask as updatePaymentTaskRow,
  updateTripCurrency,
  type ExpenseRow,
  type NewExpense,
  type ParticipantRow,
} from "@/server/repositories/trip-expense.repository";
import { requireTripRole } from "@/server/services/trip-access.service";
import { logError } from "@/server/logger";
import {
  currencyDecimals,
  type ExpenseInput,
  type PaymentTaskInput,
  type SettlementInput,
  type UpdatePaymentTaskInput,
} from "@/schemas/trip-expense.schema";
import type { TripAccessRole } from "@/schemas/trip-share.schema";

export class TripExpenseError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "PARTICIPANT_IN_USE" | "CURRENCY_LOCKED" | "RATE_UNAVAILABLE",
  ) {
    super(code);
  }
}

// Catégorie de dépense → poste du budget prévisionnel (trip.budget_*, en euros).
const BUDGET_KEYS = { lodging: "budget_lodging", transport: "budget_transit", food: "budget_dining", activity: "budget_activities" } as const;

export async function getLedger(userId: string, tripId: number) {
  const role = await requireTripRole(userId, tripId, "viewer");
  return buildLedger(userId, tripId, role);
}

// Lecteur : seulement des dépenses qu'il a payées lui-même.
export async function addExpense(userId: string, tripId: number, input: ExpenseInput) {
  const { role, participants, me } = await context(userId, tripId);
  if (role === "viewer" && input.paidBy !== me) throw new TripExpenseError("FORBIDDEN");

  if (input.paymentTaskId !== undefined) {
    const task = await findPaymentTask(tripId, input.paymentTaskId);
    if (!task || task.done) throw new TripExpenseError("NOT_FOUND");
    if (role === "viewer" && task.assignee_id !== me) throw new TripExpenseError("FORBIDDEN");
  }

  const expense = await prepareExpense(userId, tripId, input, participants, false);
  if (!(await insertExpense(tripId, expense, input.paymentTaskId))) throw new TripExpenseError("NOT_FOUND");
  return buildLedger(userId, tripId, role);
}

export async function updateExpense(userId: string, tripId: number, expenseId: number, input: ExpenseInput) {
  const { role, participants, me } = await context(userId, tripId);
  const current = await requireEditableExpense(tripId, expenseId, userId, role);
  if (current.is_reimbursement || input.paymentTaskId !== undefined) throw new TripExpenseError("INVALID_INPUT");
  if (role === "viewer" && input.paidBy !== me) throw new TripExpenseError("FORBIDDEN");

  const expense = await prepareExpense(userId, tripId, input, participants, false);
  if (!(await replaceExpense(tripId, expenseId, expense))) throw new TripExpenseError("NOT_FOUND");
  return buildLedger(userId, tripId, role);
}

export async function deleteExpense(userId: string, tripId: number, expenseId: number) {
  const { role } = await context(userId, tripId);
  await requireEditableExpense(tripId, expenseId, userId, role);
  if (!(await deleteExpenseRow(tripId, expenseId))) throw new TripExpenseError("NOT_FOUND");
  return buildLedger(userId, tripId, role);
}

// « Marquer comme remboursé » : dépense spéciale, payée par le débiteur, entièrement au profit du créancier.
export async function settle(userId: string, tripId: number, input: SettlementInput) {
  const { role, participants, me } = await context(userId, tripId);
  if (role === "viewer" && input.from !== me) throw new TripExpenseError("FORBIDDEN");
  const currency = await requireCurrency(tripId);
  const today = new Date().toISOString().slice(0, 10);

  const expense = await prepareExpense(
    userId,
    tripId,
    {
      title: "Remboursement",
      amount: input.amount,
      currency: currency as ExpenseInput["currency"],
      paidBy: input.from,
      spentOn: today,
      category: "other",
      split: { mode: "equal", shares: [{ participantId: input.to, value: 1 }] },
    },
    participants,
    true,
  );
  await insertExpense(tripId, expense);
  return buildLedger(userId, tripId, role);
}

export async function addGuest(userId: string, tripId: number, name: string) {
  const { role } = await context(userId, tripId, "editor");
  await insertGuest(tripId, name);
  return buildLedger(userId, tripId, role);
}

export async function renameGuest(userId: string, tripId: number, participantId: number, name: string) {
  const { role } = await context(userId, tripId, "editor");
  if (!(await updateGuestName(tripId, participantId, name))) throw new TripExpenseError("NOT_FOUND");
  return buildLedger(userId, tripId, role);
}

export async function removeGuest(userId: string, tripId: number, participantId: number) {
  const { role } = await context(userId, tripId, "editor");
  const result = await deleteGuest(tripId, participantId);
  if (result === "missing") throw new TripExpenseError("NOT_FOUND");
  if (result === "in_use") throw new TripExpenseError("PARTICIPANT_IN_USE");
  return buildLedger(userId, tripId, role);
}

export async function setTripCurrency(userId: string, tripId: number, currency: string) {
  const { role } = await context(userId, tripId, "editor");
  if (!(await updateTripCurrency(tripId, currency))) throw new TripExpenseError("CURRENCY_LOCKED");
  return buildLedger(userId, tripId, role);
}

export async function addPaymentTask(userId: string, tripId: number, input: PaymentTaskInput) {
  const { role, participants } = await context(userId, tripId, "editor");
  requireParticipant(participants, input.assigneeId);
  await insertPaymentTask(tripId, { label: input.label, estimated_minor: input.estimated, assignee_id: input.assigneeId });
  return buildLedger(userId, tripId, role);
}

export async function updatePaymentTask(userId: string, tripId: number, taskId: number, input: UpdatePaymentTaskInput) {
  const { role, participants } = await context(userId, tripId, "editor");
  requireParticipant(participants, input.assigneeId ?? null);
  const { estimated, assigneeId, ...fields } = input;
  const changed = await updatePaymentTaskRow(tripId, taskId, {
    ...fields,
    ...(estimated !== undefined ? { estimated_minor: estimated } : {}),
    ...(assigneeId !== undefined ? { assignee_id: assigneeId } : {}),
  });
  if (!changed) throw new TripExpenseError("NOT_FOUND");
  return buildLedger(userId, tripId, role);
}

export async function deletePaymentTask(userId: string, tripId: number, taskId: number) {
  const { role } = await context(userId, tripId, "editor");
  if (!(await deletePaymentTaskRow(tripId, taskId))) throw new TripExpenseError("NOT_FOUND");
  return buildLedger(userId, tripId, role);
}

async function context(userId: string, tripId: number, minimum: TripAccessRole = "viewer") {
  const role = await requireTripRole(userId, tripId, minimum);
  await ensureAccountParticipants(tripId);
  const participants = await findParticipants(tripId);
  const me = participants.find((participant) => participant.user_id === userId)?.id ?? null;
  return { role, participants, me };
}

// Éditeur : toute dépense ; lecteur : celles qu'il a saisies.
async function requireEditableExpense(tripId: number, expenseId: number, userId: string, role: TripAccessRole): Promise<ExpenseRow> {
  const expense = await findExpense(tripId, expenseId);
  if (!expense) throw new TripExpenseError("NOT_FOUND");
  if (role === "viewer" && expense.created_by !== userId) throw new TripExpenseError("FORBIDDEN");
  return expense;
}

function requireParticipant(participants: ParticipantRow[], id: number | null) {
  if (id !== null && !participants.some((participant) => participant.id === id)) throw new TripExpenseError("INVALID_INPUT");
}

async function requireCurrency(tripId: number) {
  const currency = await findTripCurrency(tripId);
  if (!currency) throw new TripExpenseError("NOT_FOUND");
  return currency;
}

// Convertit dans la devise du voyage (taux figé) puis répartit au centime près.
async function prepareExpense(
  userId: string,
  tripId: number,
  input: ExpenseInput,
  participants: ParticipantRow[],
  isReimbursement: boolean,
): Promise<NewExpense> {
  requireParticipant(participants, input.paidBy);
  input.split.shares.forEach((share) => requireParticipant(participants, share.participantId));
  const base = await requireCurrency(tripId);

  let rate: number;
  try {
    rate = await getExchangeRate(input.currency, base, input.spentOn);
  } catch (error) {
    logError("trips.rates", error);
    throw new TripExpenseError("RATE_UNAVAILABLE");
  }
  const baseAmount = Math.round(
    (input.amount / 10 ** currencyDecimals(input.currency)) * rate * 10 ** currencyDecimals(base),
  );

  const weights = input.split.shares.map((share) => (input.split.mode === "equal" ? 1 : share.value));
  const shares = allocate(baseAmount, weights);

  return {
    title: input.title,
    amount_minor: input.amount,
    currency: input.currency,
    rate,
    base_amount_minor: baseAmount,
    paid_by: input.paidBy,
    spent_on: input.spentOn,
    category: input.category,
    split_mode: input.split.mode,
    is_reimbursement: isReimbursement,
    created_by: userId,
    shares: input.split.shares.map((share, index) => ({ participant_id: share.participantId, weight: weights[index], share_minor: shares[index] })),
  };
}

// Plus forts restes : la somme des parts vaut exactement le total. BigInt : poids × montant peut dépasser 2^53.
export function allocate(total: number, weights: number[]): number[] {
  const scaled = weights.map((weight) => BigInt(Math.round(weight * 100)));
  const sum = scaled.reduce((acc, weight) => acc + weight, BigInt(0));
  const big = BigInt(total);
  const parts = scaled.map((weight) => (big * weight) / sum);
  const remainders = scaled.map((weight, index) => ({ index, rest: (big * weight) % sum }));
  let left = Number(big - parts.reduce((acc, part) => acc + part, BigInt(0)));
  remainders.sort((a, b) => (b.rest > a.rest ? 1 : b.rest < a.rest ? -1 : a.index - b.index));
  for (const { index } of remainders) {
    if (left-- <= 0) break;
    parts[index] += BigInt(1);
  }
  return parts.map(Number);
}

// Moins de virements possible : le plus gros débiteur rembourse le plus gros créancier, et ainsi de suite.
export function settlements(balances: { participant_id: number; balance: number }[]) {
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, balance: -b.balance }));
  const transfers: { from: number; to: number; amount: number }[] = [];
  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].balance, creditors[j].balance);
    if (amount > 0) transfers.push({ from: debtors[i].participant_id, to: creditors[j].participant_id, amount });
    debtors[i].balance -= amount;
    creditors[j].balance -= amount;
    if (debtors[i].balance === 0) i++;
    if (creditors[j].balance === 0) j++;
  }
  return transfers;
}

async function buildLedger(userId: string, tripId: number, role: TripAccessRole) {
  await ensureAccountParticipants(tripId);
  const [trip, participants, expenses, paymentTasks] = await Promise.all([
    findTripById(tripId),
    findParticipants(tripId),
    findExpenses(tripId),
    findPaymentTasks(tripId),
  ]);
  if (!trip) throw new TripExpenseError("NOT_FOUND");
  const currency = await requireCurrency(tripId);

  const paid = new Map<number, number>();
  const owed = new Map<number, number>();
  const spentByCategory: Record<string, number> = {};
  let total = 0;
  for (const expense of expenses) {
    const amount = Number(expense.base_amount_minor);
    paid.set(expense.paid_by, (paid.get(expense.paid_by) ?? 0) + amount);
    for (const share of expense.shares) owed.set(share.participant_id, (owed.get(share.participant_id) ?? 0) + Number(share.share_minor));
    if (!expense.is_reimbursement) {
      total += amount;
      spentByCategory[expense.category] = (spentByCategory[expense.category] ?? 0) + amount;
    }
  }
  const balances = participants.map((participant) => ({
    participant_id: participant.id,
    paid: paid.get(participant.id) ?? 0,
    owed: owed.get(participant.id) ?? 0,
    balance: (paid.get(participant.id) ?? 0) - (owed.get(participant.id) ?? 0),
  }));

  // Budget prévisionnel en euros : comparé au réel seulement si le voyage est en euros.
  const budget =
    currency === "EUR"
      ? Object.fromEntries(Object.entries(BUDGET_KEYS).map(([category, key]) => [category, trip[key] * 100]))
      : null;

  return {
    role,
    currency,
    me: participants.find((participant) => participant.user_id === userId)?.id ?? null,
    participants,
    expenses: expenses.map((expense) => ({
      ...expense,
      amount_minor: Number(expense.amount_minor),
      base_amount_minor: Number(expense.base_amount_minor),
      rate: Number(expense.rate),
      shares: expense.shares.map((share) => ({ ...share, weight: Number(share.weight), share_minor: Number(share.share_minor) })),
      // Ce que l'utilisateur peut modifier (affichage des boutons côté client).
      editable: role !== "viewer" || expense.created_by === userId,
    })),
    total,
    spentByCategory,
    budget,
    balances,
    settlements: settlements(balances),
    paymentTasks: paymentTasks.map((task) => ({ ...task, estimated_minor: task.estimated_minor === null ? null : Number(task.estimated_minor) })),
  };
}

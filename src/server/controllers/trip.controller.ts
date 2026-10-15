import "server-only";
import type { z } from "zod";
import { getUserIdFromRequest } from "@/server/jwt";
import { getConfig } from "@/server/config";
import { isRateLimited } from "@/server/rateLimit";
import {
  addTripItem,
  addTripTask,
  answerTripSuggestion,
  createTrip,
  deleteTrip,
  deleteTripItem,
  deleteTripTask,
  getTrip,
  getTripMessages,
  listTrips,
  regenerateTrip,
  sendTripMessage,
  TripError,
  updateTrip,
  updateTripItem,
  updateTripTask,
} from "@/server/services/trip.service";
import {
  answerTripSuggestionSchema,
  createTripItemSchema,
  createTripSchema,
  createTripTaskSchema,
  idParamSchema,
  sendTripMessageSchema,
  updateTripItemSchema,
  updateTripSchema,
  updateTripTaskSchema,
} from "@/schemas/trip.schema";
import { logError } from "@/server/logger";

type Params = Promise<Record<string, string | string[] | undefined>>;

// GET /api/v1/trips
export function listTripsController(request: Request) {
  return withUser(request, async (userId) => Response.json(await listTrips(userId)));
}

// POST /api/v1/trips
export function createTripController(request: Request) {
  return withUser(request, async (userId) => {
    const body = await parseBody(request, createTripSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    if (isAiRateLimited(userId)) return errorResponse(429, "TOO_MANY_REQUESTS");

    return Response.json(await createTrip(userId, body), { status: 201 });
  });
}

// GET /api/v1/trips/[id]
export function getTripController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, (userId, tripId) => getTrip(userId, tripId).then(json));
}

// PATCH /api/v1/trips/[id]
export function updateTripController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    const body = await parseBody(request, updateTripSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    return json(await updateTrip(userId, tripId, body));
  });
}

// DELETE /api/v1/trips/[id]
export function deleteTripController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    await deleteTrip(userId, tripId);
    return new Response(null, { status: 204 });
  });
}

// POST /api/v1/trips/[id]/regenerate
export function regenerateTripController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    if (isAiRateLimited(userId)) return errorResponse(429, "TOO_MANY_REQUESTS");
    await regenerateTrip(userId, tripId);
    return json(await getTrip(userId, tripId));
  });
}

// GET /api/v1/trips/[id]/messages
export function listTripMessagesController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => json({ messages: await getTripMessages(userId, tripId) }));
}

// POST /api/v1/trips/[id]/messages
export function sendTripMessageController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    const body = await parseBody(request, sendTripMessageSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    const { max, windowMs } = getConfig().rateLimits.tripChat;
    if (isRateLimited(`trips:chat:${userId}`, max, windowMs)) {
      return errorResponse(429, "TOO_MANY_REQUESTS");
    }

    return json({ messages: await sendTripMessage(userId, tripId, body.content) }, 201);
  });
}

// PATCH /api/v1/trips/[id]/suggestions/[suggestionId]
export function answerTripSuggestionController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const suggestionId = idParamSchema.safeParse(routeParams.suggestionId);
    const body = await parseBody(request, answerTripSuggestionSchema);
    if (!suggestionId.success || !body) return errorResponse(400, "INVALID_INPUT");
    return json(await answerTripSuggestion(userId, tripId, suggestionId.data, body.accepted));
  });
}

// POST /api/v1/trips/[id]/items
export function createTripItemController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    const body = await parseBody(request, createTripItemSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    return json(await addTripItem(userId, tripId, body), 201);
  });
}

// PATCH /api/v1/trips/[id]/items/[itemId]
export function updateTripItemController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const itemId = idParamSchema.safeParse(routeParams.itemId);
    const body = await parseBody(request, updateTripItemSchema);
    if (!itemId.success || !body) return errorResponse(400, "INVALID_INPUT");
    return json(await updateTripItem(userId, tripId, itemId.data, body));
  });
}

// DELETE /api/v1/trips/[id]/items/[itemId]
export function deleteTripItemController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const itemId = idParamSchema.safeParse(routeParams.itemId);
    if (!itemId.success) return errorResponse(400, "INVALID_INPUT");
    return json(await deleteTripItem(userId, tripId, itemId.data));
  });
}

// POST /api/v1/trips/[id]/tasks
export function createTripTaskController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    const body = await parseBody(request, createTripTaskSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    return json(await addTripTask(userId, tripId, body.label), 201);
  });
}

// PATCH /api/v1/trips/[id]/tasks/[taskId]
export function updateTripTaskController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const taskId = idParamSchema.safeParse(routeParams.taskId);
    const body = await parseBody(request, updateTripTaskSchema);
    if (!taskId.success || !body) return errorResponse(400, "INVALID_INPUT");
    return json(await updateTripTask(userId, tripId, taskId.data, body));
  });
}

// DELETE /api/v1/trips/[id]/tasks/[taskId]
export function deleteTripTaskController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const taskId = idParamSchema.safeParse(routeParams.taskId);
    if (!taskId.success) return errorResponse(400, "INVALID_INPUT");
    return json(await deleteTripTask(userId, tripId, taskId.data));
  });
}

// JWT revérifié (en plus de proxy.ts) ; erreurs traduites en réponses génériques.
async function withUser(request: Request, handler: (userId: string) => Promise<Response>) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return errorResponse(401, "UNAUTHORIZED");

  try {
    return await handler(userId);
  } catch (error) {
    return handleError(error);
  }
}

async function withTrip(
  request: Request,
  params: Params,
  handler: (userId: string, tripId: number, routeParams: Record<string, string | string[] | undefined>) => Promise<Response>,
) {
  return withUser(request, async (userId) => {
    const routeParams = await params;
    const tripId = idParamSchema.safeParse(routeParams.id);
    if (!tripId.success) return errorResponse(400, "INVALID_INPUT");
    return handler(userId, tripId.data, routeParams);
  });
}

async function parseBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T> | null> {
  const body = schema.safeParse(await request.json().catch(() => null));
  return body.success ? body.data : null;
}

function isAiRateLimited(userId: string) {
  const { max, windowMs } = getConfig().rateLimits.tripAi;
  return isRateLimited(`trips:ai:${userId}`, max, windowMs);
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof TripError) {
    if (error.code === "NOT_FOUND") return errorResponse(404, "NOT_FOUND");
    if (error.code === "AI_UNAVAILABLE") return errorResponse(503, "AI_UNAVAILABLE");
    if (error.code === "CHAT_LIMIT_REACHED") return errorResponse(429, "CHAT_LIMIT_REACHED");
    if (error.code === "DAILY_LIMIT_REACHED") return errorResponse(429, "DAILY_LIMIT_REACHED");
    if (error.code === "AI_DISABLED") return errorResponse(503, "AI_DISABLED");
    if (error.code === "FORBIDDEN") return errorResponse(403, "FORBIDDEN");
    return errorResponse(400, error.code);
  }

  logError("trips", error);
  return errorResponse(500, "INTERNAL_ERROR");
}

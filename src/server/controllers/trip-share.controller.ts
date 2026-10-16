import "server-only";
import type { z } from "zod";
import { getUserIdFromRequest } from "@/server/jwt";
import { getConfig } from "@/server/config";
import { isRateLimited } from "@/server/rateLimit";
import { TripAccessError } from "@/server/services/trip-access.service";
import {
  answerInvitation,
  changeMemberRole,
  createInviteLink,
  getTripSharing,
  inviteByUsername,
  joinTrip,
  listMyInvitations,
  removeMember,
  revokeInvitation,
  TripShareError,
} from "@/server/services/trip-share.service";
import { answerTripSuggestionSchema, idParamSchema } from "@/schemas/trip.schema";
import {
  createInviteLinkSchema,
  inviteMemberSchema,
  joinTripSchema,
  memberIdParamSchema,
  updateMemberSchema,
} from "@/schemas/trip-share.schema";
import { logError } from "@/server/logger";

type Params = Promise<Record<string, string | string[] | undefined>>;

// GET /api/v1/trips/[id]/members
export function getTripSharingController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => Response.json(await getTripSharing(userId, tripId)));
}

// POST /api/v1/trips/[id]/members { username, role } : invitation par pseudo
export function inviteMemberController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    if (isShareRateLimited(userId)) return errorResponse(429, "TOO_MANY_REQUESTS");
    const body = await parseBody(request, inviteMemberSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    return Response.json(await inviteByUsername(userId, tripId, body), { status: 201 });
  });
}

// PATCH /api/v1/trips/[id]/members/[userId] { role }
export function updateMemberController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const memberId = memberIdParamSchema.safeParse(routeParams.userId);
    const body = await parseBody(request, updateMemberSchema);
    if (!memberId.success || !body) return errorResponse(400, "INVALID_INPUT");
    return Response.json(await changeMemberRole(userId, tripId, memberId.data, body.role));
  });
}

// DELETE /api/v1/trips/[id]/members/[userId] : retirer un membre, ou quitter le voyage (son propre id)
export function removeMemberController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const memberId = memberIdParamSchema.safeParse(routeParams.userId);
    if (!memberId.success) return errorResponse(400, "INVALID_INPUT");
    await removeMember(userId, tripId, memberId.data);
    return new Response(null, { status: 204 });
  });
}

// POST /api/v1/trips/[id]/invitations { role } : lien d'invitation (code renvoyé une seule fois)
export function createInviteLinkController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId) => {
    if (isShareRateLimited(userId)) return errorResponse(429, "TOO_MANY_REQUESTS");
    const body = await parseBody(request, createInviteLinkSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    return Response.json(await createInviteLink(userId, tripId, body.role), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  });
}

// DELETE /api/v1/trips/[id]/invitations/[invitationId]
export function revokeInvitationController(request: Request, { params }: { params: Params }) {
  return withTrip(request, params, async (userId, tripId, routeParams) => {
    const invitationId = idParamSchema.safeParse(routeParams.invitationId);
    if (!invitationId.success) return errorResponse(400, "INVALID_INPUT");
    return Response.json(await revokeInvitation(userId, tripId, invitationId.data));
  });
}

// GET /api/v1/trips/invitations : invitations reçues par pseudo
export function listMyInvitationsController(request: Request) {
  return withUser(request, async (userId) => Response.json({ invitations: await listMyInvitations(userId) }));
}

// PATCH /api/v1/trips/invitations/[invitationId] { accepted }
export function answerInvitationController(request: Request, { params }: { params: Params }) {
  return withUser(request, async (userId) => {
    const invitationId = idParamSchema.safeParse((await params).invitationId);
    const body = await parseBody(request, answerTripSuggestionSchema);
    if (!invitationId.success || !body) return errorResponse(400, "INVALID_INPUT");
    return Response.json(await answerInvitation(userId, invitationId.data, body.accepted));
  });
}

// POST /api/v1/trips/join { code } : rejoindre avec un lien d'invitation
export function joinTripController(request: Request) {
  return withUser(request, async (userId) => {
    if (isShareRateLimited(userId)) return errorResponse(429, "TOO_MANY_REQUESTS");
    const body = await parseBody(request, joinTripSchema);
    if (!body) return errorResponse(400, "INVALID_INPUT");
    return Response.json(await joinTrip(userId, body.code));
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

function isShareRateLimited(userId: string) {
  const { max, windowMs } = getConfig().rateLimits.tripShare;
  return isRateLimited(`trips:share:${userId}`, max, windowMs);
}

function errorResponse(status: number, code: string) {
  return Response.json({ error: code }, { status });
}

function handleError(error: unknown) {
  if (error instanceof TripAccessError) return errorResponse(error.code === "FORBIDDEN" ? 403 : 404, error.code);
  if (error instanceof TripShareError) {
    const status = { INVALID_INPUT: 400, NOT_FOUND: 404, USER_NOT_FOUND: 404, ALREADY_MEMBER: 409, INVITE_INVALID: 404, TRIP_FULL: 409 }[error.code];
    return errorResponse(status, error.code);
  }
  logError("trips.share", error);
  return errorResponse(500, "INTERNAL_ERROR");
}

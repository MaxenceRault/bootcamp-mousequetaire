import "server-only";
import { findTripRole } from "@/server/repositories/trip-share.repository";
import type { TripAccessRole } from "@/schemas/trip-share.schema";

export class TripAccessError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN") {
    super(code);
  }
}

const RANK: Record<TripAccessRole, number> = { viewer: 0, editor: 1, owner: 2 };

// Sans accès : 404, sans révéler que le voyage existe. Accès insuffisant (membre lecteur…) : 403.
export async function requireTripRole(userId: string, tripId: number, minimum: TripAccessRole): Promise<TripAccessRole> {
  const role = await findTripRole(tripId, userId);
  if (!role) throw new TripAccessError("NOT_FOUND");
  if (RANK[role] < RANK[minimum]) throw new TripAccessError("FORBIDDEN");
  return role;
}

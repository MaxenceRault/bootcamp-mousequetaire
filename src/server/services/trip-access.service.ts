import "server-only";
import { findTripRole } from "@/server/repositories/trip-share.repository";
import { findTripInternalId } from "@/server/repositories/trip.repository";
import type { TripAccessRole } from "@/schemas/trip-share.schema";

export class TripAccessError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "FORBIDDEN") {
    super(code);
  }
}

const RANK: Record<TripAccessRole, number> = { viewer: 0, editor: 1, owner: 2 };

// Identifiant public (URL) → clé interne. Inconnu : 404, comme un voyage sans accès.
export async function resolveTripId(publicId: string): Promise<number> {
  const id = await findTripInternalId(publicId);
  if (id === null) throw new TripAccessError("NOT_FOUND");
  return id;
}

// Sans accès : 404, sans révéler que le voyage existe. Accès insuffisant (membre lecteur…) : 403.
export async function requireTripRole(userId: string, tripId: number, minimum: TripAccessRole): Promise<TripAccessRole> {
  const role = await findTripRole(tripId, userId);
  if (!role) throw new TripAccessError("NOT_FOUND");
  if (RANK[role] < RANK[minimum]) throw new TripAccessError("FORBIDDEN");
  return role;
}

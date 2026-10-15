import { z } from "zod";
import { USERNAME_PATTERN } from "@/schemas/user.schema";

export const TRIP_MEMBER_ROLES = ["editor", "viewer"] as const;
export type TripMemberRole = (typeof TRIP_MEMBER_ROLES)[number];
// Rôle d'un utilisateur sur un voyage : le propriétaire n'est pas dans trip_member.
export type TripAccessRole = "owner" | TripMemberRole;

// Code d'un lien d'invitation : 32 octets aléatoires en base64url.
export const INVITE_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const inviteMemberSchema = z.strictObject({
  username: z.string().trim().toLowerCase().regex(new RegExp(USERNAME_PATTERN)),
  role: z.enum(TRIP_MEMBER_ROLES),
});

export const createInviteLinkSchema = z.strictObject({
  role: z.enum(TRIP_MEMBER_ROLES),
});

export const updateMemberSchema = z.strictObject({
  role: z.enum(TRIP_MEMBER_ROLES),
});

export const joinTripSchema = z.strictObject({
  code: z.string().regex(INVITE_CODE_PATTERN),
});

export const memberIdParamSchema = z.uuid();

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

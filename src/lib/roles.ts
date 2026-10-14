// Seul « admin » donne des droits ; les autres rôles sont des badges.
export const USER_ROLES = ["traveler", "globetrotter", "dreamer", "patron", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

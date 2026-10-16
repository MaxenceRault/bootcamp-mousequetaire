// Seul « admin » donne des droits ; les autres rôles sont des badges.
export const USER_ROLES = ["traveler", "globetrotter", "dreamer", "patron", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Badges gagnés automatiquement : nombre de récits publiés (globe-trotteur) et de récits aimés (rêveur).
export const BADGE_THRESHOLDS = { globetrotter: 50, dreamer: 50 } as const;

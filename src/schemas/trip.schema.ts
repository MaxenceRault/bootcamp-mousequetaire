import { z } from "zod";
import { POST_ARCHETYPES } from "@/lib/posts";

// Limites alignées sur les tables trip, trip_item et trip_task (db/migrations/).
// Durée maximale d'un voyage : 1 mois (début et fin inclus).
export const TRIP_MAX_DAYS = 31;
export const TRIP_ITEM_CATEGORIES = ["transport", "lodging", "activity", "food"] as const;
export const ADJUST_INSTRUCTION_MAX = 300;

const countryCode = z.string().regex(/^[A-Z]{2}$/);
const stateCode = z.string().regex(/^[A-Za-z0-9-]{1,10}$/);
const cityName = z.string().trim().min(1).max(100);
const isoDate = z.iso.date();
// Heure « HH:MM » (24 h).
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const euros = z.number().int().min(0).max(1_000_000);

// Identifiant numérique d'une route (/trips/[id], /items/[itemId]…).
export const idParamSchema = z.coerce.number().int().positive().max(2_147_483_647);

// POST /api/v1/trips : la génération par l'IA démarre à la création.
export const createTripSchema = z
  .object({
    destinationCountry: countryCode,
    destinationState: stateCode.optional(),
    destinationCity: cityName.optional(),
    startDate: isoDate,
    endDate: isoDate,
    archetype: z.enum(POST_ARCHETYPES),
  })
  .strict()
  // Dates au format AAAA-MM-JJ : la comparaison de chaînes suit l'ordre chronologique.
  .refine((trip) => trip.endDate >= trip.startDate, { path: ["endDate"] })
  .refine((trip) => !trip.destinationCity || trip.destinationState, { path: ["destinationCity"] });

// PATCH /api/v1/trips/[id] : titre et budget, champs optionnels (au moins un).
export const updateTripSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    budgetTarget: euros.nullable(),
    budgetLodging: euros,
    budgetTransit: euros,
    budgetDining: euros,
    budgetActivities: euros,
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0);

// POST /api/v1/trips/[id]/adjust : consigne libre envoyée à l'IA (non fiable, taille limitée).
export const adjustTripSchema = z
  .object({
    instruction: z.string().trim().min(3).max(ADJUST_INSTRUCTION_MAX),
  })
  .strict();

const tripItemFields = {
  day: isoDate,
  startTime: time,
  title: z.string().trim().min(1).max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null),
  category: z.enum(TRIP_ITEM_CATEGORIES),
};

// POST /api/v1/trips/[id]/items
export const createTripItemSchema = z.object(tripItemFields).strict();

// PATCH /api/v1/trips/[id]/items/[itemId]
export const updateTripItemSchema = z
  .object(tripItemFields)
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0);

// POST /api/v1/trips/[id]/tasks
export const createTripTaskSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
  })
  .strict();

// PATCH /api/v1/trips/[id]/tasks/[taskId]
export const updateTripTaskSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    done: z.boolean(),
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0);

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateTripItemInput = z.infer<typeof createTripItemSchema>;
export type UpdateTripItemInput = z.infer<typeof updateTripItemSchema>;
export type UpdateTripTaskInput = z.infer<typeof updateTripTaskSchema>;
export type TripItemCategory = (typeof TRIP_ITEM_CATEGORIES)[number];

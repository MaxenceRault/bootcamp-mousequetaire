import { z } from "zod";
import { archetypeSlugSchema } from "@/schemas/archetype.schema";

// 1 mois maximum, début et fin inclus.
export const TRIP_MAX_DAYS = 31;
export const TRIP_ITEM_CATEGORIES = ["transport", "lodging", "activity", "food"] as const;
// Court : limite le coût par message.
export const TRIP_MESSAGE_MAX = 500;

const countryCode = z.string().regex(/^[A-Z]{2}$/);
const stateCode = z.string().regex(/^[A-Za-z0-9-]{1,10}$/);
const cityName = z.string().trim().min(1).max(100);
const isoDate = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const euros = z.number().int().min(0).max(1_000_000);

export const idParamSchema = z.coerce.number().int().positive().max(2_147_483_647);

export const createTripSchema = z
  .object({
    destinationCountry: countryCode,
    destinationState: stateCode.optional(),
    destinationCity: cityName.optional(),
    startDate: isoDate,
    endDate: isoDate,
    archetype: archetypeSlugSchema,
  })
  .strict()
  // Dates AAAA-MM-JJ : l'ordre des chaînes est chronologique.
  .refine((trip) => trip.endDate >= trip.startDate, { path: ["endDate"] })
  .refine((trip) => !trip.destinationCity || trip.destinationState, { path: ["destinationCity"] });

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

export const sendTripMessageSchema = z
  .object({
    content: z.string().trim().min(2).max(TRIP_MESSAGE_MAX),
  })
  .strict();

export const answerTripSuggestionSchema = z
  .object({
    accepted: z.boolean(),
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

export const createTripItemSchema = z.object(tripItemFields).strict();

export const updateTripItemSchema = z
  .object(tripItemFields)
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0);

export const createTripTaskSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
  })
  .strict();

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

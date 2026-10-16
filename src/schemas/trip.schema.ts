import { z } from "zod";
import { archetypeSlugSchema } from "@/schemas/archetype.schema";

// 1 mois maximum, début et fin inclus.
export const TRIP_MAX_DAYS = 31;
export const TRIP_ITEM_CATEGORIES = ["transport", "lodging", "activity", "food"] as const;
// Couleur d'une case (vue Tableau, PDF) : mêmes clés que la contrainte SQL et les tokens --color-cell-* de globals.css.
export const TRIP_ITEM_COLORS = ["coral", "sky", "mint", "sun", "lavender", "sand", "rose", "slate"] as const;
export const TRIP_SUGGESTION_ACTIONS = ["add", "update", "delete"] as const;
export const TRIP_PDF_TEMPLATES = ["classic", "table", "booklet"] as const;
// Court : limite le coût par message.
export const TRIP_MESSAGE_MAX = 500;

const countryCode = z.string().regex(/^[A-Z]{2}$/);
const stateCode = z.string().regex(/^[A-Za-z0-9-]{1,10}$/);
const cityName = z.string().trim().min(1).max(100);
const isoDate = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const euros = z.number().int().min(0).max(1_000_000);

export const idParamSchema = z.coerce.number().int().positive().max(2_147_483_647);
// Voyage dans l'URL et l'API : son identifiant public (UUID), jamais la clé interne.
export const tripIdParamSchema = z.uuid();
// Jour d'un voyage dans l'URL (AAAA-MM-JJ).
export const dayParamSchema = isoDate;

export const createTripSchema = z
  .strictObject({
    destinationCountry: countryCode,
    destinationState: stateCode.optional(),
    destinationCity: cityName.optional(),
    startDate: isoDate,
    endDate: isoDate,
    archetype: archetypeSlugSchema,
  })
  // Dates AAAA-MM-JJ : l'ordre des chaînes est chronologique.
  .refine((trip) => trip.endDate >= trip.startDate, { path: ["endDate"] })
  .refine((trip) => !trip.destinationCity || trip.destinationState, { path: ["destinationCity"] });

export const updateTripSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(100),
    budgetTarget: euros.nullable(),
    budgetLodging: euros,
    budgetTransit: euros,
    budgetDining: euros,
    budgetActivities: euros,
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0);

// POST /api/v1/trips/[id]/pass : CGV acceptées et renonciation expresse au droit de rétractation (contenu numérique
// fourni dès le paiement), cases cochées par l'acheteur.
export const tripPassCheckoutSchema = z.strictObject({
  acceptSales: z.literal(true),
  waiveWithdrawal: z.literal(true),
});

export const sendTripMessageSchema = z.strictObject({
  content: z.string().trim().min(2).max(TRIP_MESSAGE_MAX),
});

export const answerTripSuggestionSchema = z.strictObject({
  accepted: z.boolean(),
});

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

export const createTripItemSchema = z.strictObject(tripItemFields);

// color : null rend la couleur de la catégorie.
export const updateTripItemSchema = z
  .strictObject({ ...tripItemFields, color: z.enum(TRIP_ITEM_COLORS).nullable() })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0);

// GET /api/v1/trips/[id]/export/pdf?template=
export const tripPdfQuerySchema = z.strictObject({ template: z.enum(TRIP_PDF_TEMPLATES).default("classic") });

export const createTripTaskSchema = z.strictObject({
  label: z.string().trim().min(1).max(120),
});

export const updateTripTaskSchema = z
  .strictObject({
    label: z.string().trim().min(1).max(120),
    done: z.boolean(),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0);

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type CreateTripItemInput = z.infer<typeof createTripItemSchema>;
export type UpdateTripItemInput = z.infer<typeof updateTripItemSchema>;
export type UpdateTripTaskInput = z.infer<typeof updateTripTaskSchema>;
export type TripItemCategory = (typeof TRIP_ITEM_CATEGORIES)[number];
export type TripItemColor = (typeof TRIP_ITEM_COLORS)[number];
export type TripSuggestionAction = (typeof TRIP_SUGGESTION_ACTIONS)[number];
export type TripPdfTemplate = (typeof TRIP_PDF_TEMPLATES)[number];

import { z } from "zod";

// Id d'une session Stripe Checkout (page de retour : ?session_id=cs_…).
export const checkoutSessionIdSchema = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{1,200}$/);

import "server-only";
import {
  countAiCallsToday,
  countUserAiCallsToday,
  findAppSettings,
  incrementAiUsage,
} from "@/lib/repositories/ai-usage.repository";
import { findUserAccess } from "@/lib/repositories/user.repository";

// Génération, re-génération et messages, hors admins.
export const AI_DAILY_LIMIT_PER_USER = 15;

export class AiQuotaError extends Error {
  constructor(
    // AI_DISABLED : IA coupée ou plafond global atteint.
    public readonly code: "FORBIDDEN" | "AI_DISABLED" | "DAILY_LIMIT_REACHED",
  ) {
    super(code);
  }
}

// Compte la tentative même si l'IA échoue ensuite : pas de relance en boucle.
export async function consumeAiCall(userId: string) {
  const [access, settings] = await Promise.all([findUserAccess(userId), findAppSettings()]);
  if (!access || access.banned_at) throw new AiQuotaError("FORBIDDEN");

  // Protègent la facture, admins compris.
  if (!settings.ai_enabled || (await countAiCallsToday()) >= settings.ai_daily_cap) {
    throw new AiQuotaError("AI_DISABLED");
  }

  const limit = access.role === "admin" ? null : AI_DAILY_LIMIT_PER_USER;
  if (!(await incrementAiUsage(userId, limit))) throw new AiQuotaError("DAILY_LIMIT_REACHED");
}

// limit null : illimité (admin).
export async function getAiQuota(userId: string): Promise<{ used: number; limit: number | null }> {
  const [access, used] = await Promise.all([findUserAccess(userId), countUserAiCallsToday(userId)]);
  return { used, limit: access?.role === "admin" ? null : AI_DAILY_LIMIT_PER_USER };
}

import "server-only";
import { getConfig } from "@/server/config";
import {
  countAiCallsToday,
  countUserAiCallsToday,
  findAppSettings,
  incrementAiUsage,
} from "@/server/repositories/ai-usage.repository";
import { findUserAccess } from "@/server/repositories/user.repository";

// Génération, re-génération et messages, hors admins (AI_DAILY_LIMIT_PER_USER dans le .env).
export function aiDailyLimitPerUser() {
  return getConfig().aiDailyLimitPerUser;
}

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

  const limit = access.role === "admin" ? null : aiDailyLimitPerUser();
  if (!(await incrementAiUsage(userId, limit))) throw new AiQuotaError("DAILY_LIMIT_REACHED");
}

// limit null : illimité (admin).
export async function getAiQuota(userId: string): Promise<{ used: number; limit: number | null }> {
  const [access, used] = await Promise.all([findUserAccess(userId), countUserAiCallsToday(userId)]);
  return { used, limit: access?.role === "admin" ? null : aiDailyLimitPerUser() };
}

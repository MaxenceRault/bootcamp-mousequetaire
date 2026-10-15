import "server-only";
import {
  findAdminActions,
  findDashboardCounts,
  findRecentUsers,
  insertAdminAction,
  type AdminActionTarget,
} from "@/lib/repositories/admin.repository";
import { countAiCallsPerDay, findAppSettings, updateAppSettings } from "@/lib/repositories/ai-usage.repository";
import {
  ArchetypeTakenError,
  findAllArchetypesWithStats,
  insertArchetype,
  updateArchetype,
} from "@/lib/repositories/archetype.repository";
import {
  deletePostById,
  deletePostPhoto,
  findPostsForAdmin,
  photoPathFromUrl,
  updatePostVisibilityById,
} from "@/lib/repositories/post.repository";
import { revokeUserRefreshTokens } from "@/lib/repositories/refresh-token.repository";
import { closeOpenReports, countOpenReports, findOpenReports } from "@/lib/repositories/report.repository";
import {
  deleteUserById,
  findUserAccess,
  findUserMediaUrls,
  findUsersForAdmin,
  updateUserBanned,
  updateUserRole,
} from "@/lib/repositories/user.repository";
import { AI_DAILY_LIMIT_PER_USER } from "@/lib/services/ai-quota.service";
import type { CreateArchetypeInput, UpdateArchetypeInput } from "@/schemas/archetype.schema";
import { ARCHETYPE_SLUG_PATTERN } from "@/schemas/archetype.schema";
import type { AdminUpdateSettingsInput, AdminUpdateUserInput } from "@/schemas/admin.schema";

export class AdminError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "CANNOT_TARGET_SELF"
      | "TARGET_IS_ADMIN"
      | "ARCHETYPE_TAKEN",
  ) {
    super(code);
  }
}

const PAGE_SIZE = 50;
const REPORTS_LIMIT = 100;
const ACTIONS_LIMIT = 200;
const AI_HISTORY_DAYS = 7;
const RECENT_USERS = 5;

// Relus en base à chaque requête : un rôle retiré prend effet immédiatement.
export async function requireAdmin(userId: string) {
  const access = await findUserAccess(userId);
  if (!access || access.banned_at || access.role !== "admin") throw new AdminError("FORBIDDEN");
}

function log(adminId: string, action: string, targetType: AdminActionTarget, targetId: string | number | null, details?: Record<string, unknown>) {
  return insertAdminAction({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId === null ? null : String(targetId),
    details: details ?? null,
  });
}

export async function getDashboard() {
  const [counts, openReports, aiPerDay, settings, recentUsers] = await Promise.all([
    findDashboardCounts(),
    countOpenReports(),
    countAiCallsPerDay(AI_HISTORY_DAYS),
    findAppSettings(),
    findRecentUsers(RECENT_USERS),
  ]);
  return {
    counts: { ...counts, open_reports: openReports },
    ai: {
      today: aiPerDay.at(-1)?.total ?? 0,
      perDay: aiPerDay,
      enabled: settings.ai_enabled,
      dailyCap: settings.ai_daily_cap,
      perUserLimit: AI_DAILY_LIMIT_PER_USER,
    },
    recentUsers,
  };
}

export async function listUsers({ q, page }: { q?: string; page: number }) {
  const { users, total } = await findUsersForAdmin({ search: q, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
  return { users, total, page, pageSize: PAGE_SIZE };
}

export async function updateUser(adminId: string, userId: string, input: AdminUpdateUserInput) {
  if (userId === adminId) throw new AdminError("CANNOT_TARGET_SELF");
  const target = await findUserAccess(userId);
  if (!target) throw new AdminError("NOT_FOUND");

  if (input.banned !== undefined) {
    // Rétrograder puis bannir dans la même requête est permis.
    if (input.banned && (input.role ?? target.role) === "admin") throw new AdminError("TARGET_IS_ADMIN");
  }

  if (input.role !== undefined && input.role !== target.role) {
    await updateUserRole(userId, input.role);
    await log(adminId, "user.role", "user", userId, { from: target.role, to: input.role });
  }

  if (input.banned !== undefined && input.banned !== Boolean(target.banned_at)) {
    await updateUserBanned(userId, input.banned);
    // L'access token en cours expire dans l'heure.
    if (input.banned) await revokeUserRefreshTokens(userId);
    await log(adminId, input.banned ? "user.ban" : "user.unban", "user", userId);
  }

  return findUserAccess(userId);
}

export async function deleteUser(adminId: string, userId: string) {
  if (userId === adminId) throw new AdminError("CANNOT_TARGET_SELF");
  const target = await findUserAccess(userId);
  if (!target) throw new AdminError("NOT_FOUND");
  if (target.role === "admin") throw new AdminError("TARGET_IS_ADMIN");

  const mediaUrls = await findUserMediaUrls(userId);
  if (!(await deleteUserById(userId))) throw new AdminError("NOT_FOUND");
  await log(adminId, "user.delete", "user", userId);

  // Le compte est supprimé : une photo qui résiste ne fait pas échouer la requête.
  await Promise.all(
    mediaUrls.map((url) => {
      const path = photoPathFromUrl(url);
      return path ? deletePostPhoto(path).catch(() => {}) : null;
    }),
  );
}

export async function listPosts({ q, page, visibility }: { q?: string; page: number; visibility: "all" | "visible" | "hidden" }) {
  const { posts, total } = await findPostsForAdmin({ search: q, visibility, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE });
  return { posts, total, page, pageSize: PAGE_SIZE };
}

export async function setPostHidden(adminId: string, postId: number, hidden: boolean) {
  if (!(await updatePostVisibilityById(postId, hidden))) throw new AdminError("NOT_FOUND");
  // Masqué : signalements traités ; réaffiché (ex. post en attente de modération) : validé.
  await closeOpenReports(postId, hidden ? "resolved" : "dismissed");
  await log(adminId, hidden ? "post.hide" : "post.show", "post", postId);
  return { id: postId, hidden };
}

export async function deletePost(adminId: string, postId: number) {
  const photoUrl = await deletePostById(postId);
  if (photoUrl === null) throw new AdminError("NOT_FOUND");
  await log(adminId, "post.delete", "post", postId);

  const path = photoPathFromUrl(photoUrl);
  if (path) await deletePostPhoto(path).catch(() => {});
}

export function listOpenReports() {
  return findOpenReports(REPORTS_LIMIT);
}

export async function dismissReports(adminId: string, postId: number) {
  const closed = await closeOpenReports(postId, "dismissed");
  if (closed === 0) throw new AdminError("NOT_FOUND");
  await log(adminId, "reports.dismiss", "post", postId, { count: closed });
}

export function listArchetypes() {
  return findAllArchetypesWithStats();
}

export async function createArchetype(adminId: string, input: CreateArchetypeInput) {
  const slug = input.slug ?? slugify(input.label);
  if (!ARCHETYPE_SLUG_PATTERN.test(slug)) throw new AdminError("INVALID_INPUT");

  try {
    const archetype = await insertArchetype({ slug, label: input.label, description: input.description ?? null });
    await log(adminId, "archetype.create", "archetype", archetype.id, { slug, label: input.label });
    return archetype;
  } catch (error) {
    if (error instanceof ArchetypeTakenError) throw new AdminError("ARCHETYPE_TAKEN");
    throw error;
  }
}

export async function editArchetype(adminId: string, id: number, input: UpdateArchetypeInput) {
  try {
    const archetype = await updateArchetype(id, {
      label: input.label,
      description: input.description,
      is_active: input.isActive,
    });
    if (!archetype) throw new AdminError("NOT_FOUND");
    await log(adminId, "archetype.update", "archetype", id, { ...input });
    return archetype;
  } catch (error) {
    if (error instanceof ArchetypeTakenError) throw new AdminError("ARCHETYPE_TAKEN");
    throw error;
  }
}

// « Road trip & van » → « road_trip_van ».
function slugify(label: string) {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
}

export function getSettings() {
  return findAppSettings();
}

export async function updateSettings(adminId: string, input: AdminUpdateSettingsInput) {
  const settings = await updateAppSettings({ ai_enabled: input.aiEnabled, ai_daily_cap: input.aiDailyCap });
  await log(adminId, "settings.update", "settings", null, { ...input });
  return settings;
}

export function listActions() {
  return findAdminActions(ACTIONS_LIMIT);
}

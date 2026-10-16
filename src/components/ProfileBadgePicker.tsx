"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { apiFetch } from "@/client/session";
import type { UserRole } from "@/lib/roles";

type MyBadges = {
  badges: { badge: UserRole; unlocked: boolean }[];
  displayed: UserRole;
  progress: { posts: number; likes: number };
  thresholds: { globetrotter: number; dreamer: number };
};

// « Mon badge » (profil du compte connecté) : choisir le badge affiché parmi ceux débloqués.
// Les badges débloqués sont calculés par le serveur, qui refuse aussi un badge verrouillé.
export function ProfileBadgePicker({ onChange }: { onChange: (badge: UserRole) => void }) {
  const t = useTranslations("Profile.badges");
  const tRoles = useTranslations("Roles");
  const [data, setData] = useState<MyBadges | null>(null);
  const [pending, setPending] = useState<UserRole | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MyBadges>("/api/v1/users/me/badge").then((result) => {
      if (!cancelled && "data" in result) setData(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(badge: UserRole) {
    if (!data || badge === data.displayed) return;
    setPending(badge);
    setError(false);
    const result = await apiFetch<MyBadges>("/api/v1/users/me/badge", { method: "PUT", body: { badge } });
    setPending(null);
    if (!("data" in result)) return setError(true);
    setData(result.data);
    onChange(result.data.displayed);
  }

  function progress(badge: UserRole) {
    if (!data) return null;
    if (badge === "globetrotter") return t("progressPosts", { count: Math.min(data.progress.posts, data.thresholds.globetrotter), total: data.thresholds.globetrotter });
    if (badge === "dreamer") return t("progressLikes", { count: Math.min(data.progress.likes, data.thresholds.dreamer), total: data.thresholds.dreamer });
    return null;
  }

  if (!data) return null;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-headline-sm text-ink">{t("title")}</h2>
        <p className="text-body-sm text-ink-soft">{t("hint")}</p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {data.badges.map(({ badge, unlocked }) => {
          const selected = badge === data.displayed;
          const hint = progress(badge);
          return (
            <li key={badge}>
              <button
                type="button"
                onClick={() => void choose(badge)}
                disabled={!unlocked || pending !== null}
                aria-pressed={selected}
                title={unlocked ? undefined : t("locked")}
                className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none ${
                  selected
                    ? "border-accent bg-accent/10 text-ink"
                    : unlocked
                      ? "border-line bg-surface-muted text-ink hover:bg-surface"
                      : "cursor-not-allowed border-line bg-surface-muted text-ink-soft opacity-60"
                }`}
              >
                <span className="flex items-center gap-1.5 font-display text-label-lg">
                  <Icon name={selected ? "check" : unlocked ? "sparkles" : "lock"} className={`size-4 ${selected ? "text-accent" : ""}`} />
                  {tRoles(badge)}
                </span>
                {!unlocked && hint && <span className="text-label-sm text-ink-soft">{hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <FormError>{t("error")}</FormError>}
    </Card>
  );
}

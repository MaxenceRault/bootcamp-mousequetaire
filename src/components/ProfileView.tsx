"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ProfileEditForm, type EditableProfile } from "@/components/ProfileEditForm";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { countryName, flagEmoji } from "@/lib/country";
import { apiFetch, updateSessionUser } from "@/lib/session";

type Story = {
  id: number;
  title: string;
  photo_url: string;
  photo_alt: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  start_date: string;
  created_at: string;
};

type ProfileData = { user: EditableProfile; stories: Story[]; storyCount: number };

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; profile: ProfileData };

const TABS = ["stories", "itineraries", "saved"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, IconName> = { stories: "book", itineraries: "sparkles", saved: "bookmark" };

// Page profil de l'utilisateur connecté : GET /api/v1/users/me avec le token du navigateur.
// Sans session valide, redirection vers la connexion.
export function ProfileView() {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    apiFetch<ProfileData>("/api/v1/users/me").then((result) => {
      if (cancelled) return;
      if (!("error" in result)) return setState({ status: "ready", profile: result.data });
      if (result.error === "UNAUTHORIZED") return router.replace("/login");
      setState({ status: "error" });
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.status === "loading") return <ProfileSkeleton />;
  if (state.status === "error") {
    return <p className="py-16 text-center text-body-md text-ink-soft">{t("loadError")}</p>;
  }

  return (
    <Profile
      profile={state.profile}
      onUserChange={(user) => setState({ status: "ready", profile: { ...state.profile, user } })}
    />
  );
}

function Profile({ profile, onUserChange }: { profile: ProfileData; onUserChange: (user: EditableProfile) => void }) {
  const t = useTranslations("Profile");
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("stories");
  const { user } = profile;

  function handleSaved(updated: EditableProfile) {
    onUserChange(updated);
    // Met aussi à jour la Navbar (nom, pseudo).
    updateSessionUser({
      id: updated.id,
      username: updated.username,
      display_name: updated.display_name,
      avatar_url: updated.avatar_url,
      avatar_seed: updated.avatar_seed,
    });
    setEditing(false);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-10">
      <Card className="overflow-hidden">
        {/* Bannière décorative. */}
        <div aria-hidden="true" className="relative h-40 bg-[url(/home-bg.jpg)] bg-cover bg-center sm:h-56">
          <div className="absolute inset-0 bg-linear-to-t from-ink/60 via-ink/20 to-transparent" />
        </div>

        <div className="flex flex-col gap-4 px-4 pb-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative z-10 -mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <div className="w-fit rounded-xl bg-surface p-1 shadow-md">
              <Avatar src={user.avatar_url} name={user.avatar_seed ?? user.id} alt="" size={104} />
            </div>
            <div className="pb-1">
              <h1 className="font-display text-headline-md text-ink">{user.display_name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-body-sm text-ink-soft/70">
                <span className="font-medium text-ink-soft">@{user.username}</span>
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1">
                  <Icon name="pin" className="size-3.5" />
                  {user.location ?? t("noLocation")}
                </span>
              </p>
            </div>
          </div>

          {!editing && (
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => {
                setSaved(false);
                setEditing(true);
              }}
            >
              <Icon name="edit" className="size-4" />
              {t("edit")}
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-px border-t border-line bg-line sm:grid-cols-3">
          <Stat label={t("stats.location")} icon="pin">
            {user.location ?? t("noLocation")}
          </Stat>
          <Stat label={t("stats.stories")} icon="book">
            {t("stats.storiesValue", { count: profile.storyCount })}
          </Stat>
          <Stat label={t("stats.memberSince")} icon="calendar">
            {format.dateTime(new Date(user.created_at), { month: "long", year: "numeric" })}
          </Stat>
        </dl>
      </Card>

      {saved && (
        <p role="status" className="-mt-6 text-body-md text-ink-soft">
          {t("form.saved")}
        </p>
      )}

      {editing && <ProfileEditForm user={user} onSaved={handleSaved} onCancel={() => setEditing(false)} />}

      <section className="flex flex-col gap-6">
        <div
          role="tablist"
          aria-label={t("tabsLabel")}
          className="flex w-full gap-1 overflow-x-auto rounded-lg border border-line bg-surface-muted p-1.5 sm:w-fit"
        >
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`profile-tab-${key}`}
              aria-selected={tab === key}
              aria-controls="profile-tabpanel"
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 font-display text-label-lg whitespace-nowrap transition ${
                tab === key ? "bg-surface text-ink shadow-xs" : "text-ink-soft hover:text-ink"
              }`}
            >
              <Icon name={TAB_ICONS[key]} className={`size-4 ${tab === key ? "text-accent" : ""}`} />
              {t(`tabs.${key}`)}
              {key === "stories" && <span className="text-label-sm text-ink-soft/70">{profile.storyCount}</span>}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="profile-tabpanel" aria-labelledby={`profile-tab-${tab}`}>
          {tab === "stories" && <StoriesGrid stories={profile.stories} />}
          {tab === "itineraries" && (
            <EmptyState>
              {t("empty.itineraries")}
              {/* La création d'itinéraire se fait dans le planificateur. */}
              <Link href="/planner" className={buttonClassName("sm", "mt-4")}>
                <Icon name="add" className="size-4" />
                {t("createItinerary")}
              </Link>
            </EmptyState>
          )}
          {tab === "saved" && <EmptyState>{t("empty.saved")}</EmptyState>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4">
      <dt className="font-display text-label-sm text-ink-soft/70 uppercase">{label}</dt>
      <dd className="flex items-center gap-1.5 font-display text-label-lg text-ink">
        <Icon name={icon} className="size-4 text-accent" />
        {children}
      </dd>
    </div>
  );
}

function StoriesGrid({ stories }: { stories: Story[] }) {
  const t = useTranslations("Profile");
  const format = useFormatter();
  const locale = useLocale();

  if (stories.length === 0) return <EmptyState>{t("empty.stories")}</EmptyState>;

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <li key={story.id}>
          <Link href={`/post/${story.id}`} className="group block h-full">
            <Card className="h-full overflow-hidden shadow-xs transition group-hover:shadow-md">
              <div className="relative aspect-4/3 overflow-hidden bg-surface-muted">
                {/* unoptimized : l'hébergement des photos n'est pas encore choisi, on ne peut pas
                    déclarer l'hôte dans next.config (remotePatterns). */}
                <Image
                  src={story.photo_url}
                  alt={story.photo_alt}
                  fill
                  unoptimized
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col gap-1.5 p-4">
                <h3 className="font-display text-label-lg text-ink">{story.title}</h3>
                <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-ink-soft/70">
                  <span>
                    {story.destination_city ?? countryName(story.destination_country_code, locale)}{" "}
                    <span aria-hidden="true">{flagEmoji(story.destination_country_code)}</span>
                  </span>
                  <span aria-hidden="true">•</span>
                  {/* Date du voyage (début du séjour). */}
                  <time dateTime={story.start_date}>
                    {format.dateTime(new Date(story.start_date), { month: "short", year: "numeric" })}
                  </time>
                </p>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center text-body-md text-ink-soft">{children}</Card>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-10">
      <Card className="overflow-hidden">
        <div className="h-40 bg-surface-muted sm:h-56" />
        <div className="flex items-end gap-4 px-6 pb-6">
          <div className="-mt-12 size-28 rounded-xl bg-surface-muted ring-4 ring-surface" />
          <div className="h-6 w-48 rounded-lg bg-surface-muted" />
        </div>
      </Card>
      <div className="h-11 w-96 max-w-full rounded-lg bg-surface-muted" />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { PROFILE_TABS_CLASS_NAME, ProfileHeader, ProfileStat, ProfileStats, profileTabClassName } from "@/components/ProfileHeader";
import { StoryCard, StoryGrid } from "@/components/StoryCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getPublicProfile, ProfileError, type PublicProfile } from "@/server/services/user.service";
import { usernameParamSchema } from "@/schemas/user.schema";

// Onglets d'un profil public : jamais « Itinéraires IA ». « Enregistrés » seulement si l'utilisateur les partage.
const TABS = ["stories", "saved"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, IconName> = { stories: "book", saved: "bookmark" };

// Profil lu une seule fois par visite (generateMetadata + page). Pseudo invalide : introuvable, sans requête.
// Server Component = couche controller : appel direct du service (réglages de confidentialité appliqués là).
const loadProfile = cache(async (rawUsername: string): Promise<PublicProfile | null> => {
  const username = usernameParamSchema.safeParse(rawUsername);
  if (!username.success) return null;
  try {
    return await getPublicProfile(username.data);
  } catch (error) {
    if (error instanceof ProfileError && error.code === "NOT_FOUND") return null;
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps<"/profile/[username]">): Promise<Metadata> {
  const profile = await loadProfile((await params).username);
  if (!profile) return {};
  const t = await getTranslations("PublicProfile");
  return { title: t("metaTitle", { name: profile.user.display_name, username: profile.user.username }) };
}

export default function PublicProfilePage({ params, searchParams }: PageProps<"/profile/[username]">) {
  return (
    <>
      <Navbar />
      <main className="w-full flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-300 px-4 md:px-6">
          {/* Le profil dépend de l'URL et de réglages modifiables à tout moment : rendu à la requête. */}
          <Suspense>
            <PublicProfileContent params={params} searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function PublicProfileContent({ params, searchParams }: Pick<PageProps<"/profile/[username]">, "params" | "searchParams">) {
  await connection();
  const profile = await loadProfile((await params).username);
  if (!profile) notFound();

  const t = await getTranslations("PublicProfile");
  const tProfile = await getTranslations("Profile");
  const format = await getFormatter();

  if (profile.isPrivate) {
    return (
      <div className="flex flex-col gap-10">
        <ProfileHeader user={profile.user} />
        <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Icon name="lock" className="size-8 text-ink-soft" />
          <p className="font-display text-headline-sm text-ink">{t("private")}</p>
          <p className="text-body-md text-ink-soft">{t("privateHint")}</p>
        </Card>
      </div>
    );
  }

  const { user } = profile;
  // Allowlist : onglet « Enregistrés » demandé mais non partagé → récits.
  const { tab: rawTab } = await searchParams;
  const requested = TABS.find((tab) => tab === rawTab) ?? "stories";
  const tabs = TABS.filter((tab) => tab !== "saved" || profile.saved !== null);
  const tab: Tab = tabs.includes(requested) ? requested : "stories";
  const stories = tab === "saved" ? (profile.saved ?? []) : profile.stories;

  return (
    <div className="flex flex-col gap-10">
      <ProfileHeader user={user}>
        <ProfileStats>
          <ProfileStat label={tProfile("stats.location")} icon="pin">
            {user.location ?? tProfile("noLocation")}
          </ProfileStat>
          <ProfileStat label={tProfile("stats.stories")} icon="book">
            {tProfile("stats.storiesValue", { count: profile.storyCount })}
          </ProfileStat>
          <ProfileStat label={tProfile("stats.memberSince")} icon="calendar">
            {format.dateTime(new Date(user.created_at), { month: "long", year: "numeric" })}
          </ProfileStat>
        </ProfileStats>
      </ProfileHeader>

      <section className="flex flex-col gap-6">
        {/* Onglets = liens (?tab=) : la page reste rendue côté serveur, sans JavaScript. */}
        <nav aria-label={tProfile("tabsLabel")} className={PROFILE_TABS_CLASS_NAME}>
          {tabs.map((key) => (
            <Link
              key={key}
              href={key === "stories" ? `/profile/${user.username}` : `/profile/${user.username}?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={profileTabClassName(tab === key)}
            >
              <Icon name={TAB_ICONS[key]} className={`size-4 ${tab === key ? "text-accent" : ""}`} />
              {tProfile(`tabs.${key}`)}
              <span className="text-label-sm text-ink-soft/70">
                {key === "stories" ? profile.storyCount : (profile.saved?.length ?? 0)}
              </span>
            </Link>
          ))}
        </nav>

        {stories.length === 0 ? (
          <EmptyState>
            {tab === "saved" ? t("empty.saved") : t("empty.stories", { name: user.display_name })}
          </EmptyState>
        ) : (
          <StoryGrid>
            {stories.map((story) => (
              <li key={story.id}>
                <StoryCard story={story} />
              </li>
            ))}
          </StoryGrid>
        )}
      </section>
    </div>
  );
}

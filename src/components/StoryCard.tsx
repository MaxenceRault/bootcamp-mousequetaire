import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { countryName, flagEmoji } from "@/lib/country";

export type StoryCardData = {
  id: number;
  title: string;
  slug: string;
  photo_url: string;
  photo_alt: string;
  destination_country_code: string;
  destination_city: string | null;
  start_date: string;
  author?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    avatar_seed: string | null;
    avatar_background_color?: string | null;
  };
};

type StoryCardProps = {
  story: StoryCardData;
  hidden?: boolean;
  // Masqué en attente de modération (badge différent).
  pendingReview?: boolean;
  // Hors du lien : pas de bouton dans un <a>.
  actions?: ReactNode;
};

// Référencé par aria-describedby dans les boutons d'actions.
export const storyTitleId = (id: number) => `story-title-${id}`;

export function StoryCard({ story, hidden = false, pendingReview = false, actions }: StoryCardProps) {
  const t = useTranslations("StoryCard");
  const format = useFormatter();
  const locale = useLocale();

  return (
    <Card className="group flex h-full flex-col overflow-hidden shadow-xs transition hover:shadow-md">
      <Link href={`/post/${story.slug}`} className="block flex-1">
        <div className="relative aspect-4/3 overflow-hidden bg-surface-muted">
          <Image
            src={story.photo_url}
            alt={story.photo_alt}
            fill
            sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw"
            className={`object-cover transition duration-500 group-hover:scale-105 ${hidden ? "opacity-50" : ""}`}
          />
          {hidden && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-lg bg-ink/80 px-2 py-1 font-display text-label-sm text-surface">
              <Icon name={pendingReview ? "clock" : "visibilityOff"} className="size-3.5" />
              {pendingReview ? t("pendingReview") : t("hidden")}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          <h3 id={storyTitleId(story.id)} className="font-display text-label-lg text-ink">
            {story.title}
          </h3>
          <p className="flex flex-wrap items-center gap-1.5 text-body-sm text-ink-soft/70">
            <span>
              {story.destination_city ?? countryName(story.destination_country_code, locale)}{" "}
              <span aria-hidden="true">{flagEmoji(story.destination_country_code)}</span>
            </span>
            <span aria-hidden="true">•</span>
            <time dateTime={story.start_date}>
              {format.dateTime(new Date(story.start_date), { month: "short", year: "numeric" })}
            </time>
          </p>
          {story.author && (
            <p className="mt-1 flex items-center gap-2 text-body-sm text-ink-soft">
              <Avatar
                src={story.author.avatar_url}
                name={story.author.avatar_seed ?? story.author.id}
                backgroundColor={story.author.avatar_background_color}
                alt="" size={20} />
              {story.author.display_name}
            </p>
          )}
        </div>
      </Link>
      {actions && <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">{actions}</div>}
    </Card>
  );
}

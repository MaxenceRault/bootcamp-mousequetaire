import Image from "next/image";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { PostReactions } from "@/components/PostReactions";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { countryName, flagEmoji } from "@/lib/country";
import type { FeedPost } from "@/lib/posts";

type TravelCardProps = {
  post: FeedPost;
  // Instant de référence pour « il y a 2 heures » (le même pour toute la liste).
  now: Date;
  // Précharger l'image (premier post visible à l'écran).
  preload?: boolean;
};

// Carte d'un post dans le feed. Composant synchrone (hooks next-intl) : rendu aussi bien
// côté serveur que dans FeedList (client) pour les posts chargés au défilement.
export function TravelCard({ post, now, preload = false }: TravelCardProps) {
  const t = useTranslations("TravelCard");
  const tArchetypes = useTranslations("Archetypes");
  const format = useFormatter();
  const country = countryName(post.countryCode, useLocale());

  return (
    <Card className="p-4 shadow-xs transition hover:border-ink-soft/25 sm:p-6">
      <article>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={post.author.avatarUrl} name={post.author.avatarSeed ?? post.author.id}
              backgroundColor={post.author.avatarBackgroundColor} alt="" size={40} />
            <div className="min-w-0">
              <p className="mb-1 font-display text-label-lg text-ink">{post.author.displayName}</p>
              <p className="flex flex-wrap items-center gap-1 text-body-sm text-ink-soft/70">
                <span>
                  {post.location ?? country}{" "}
                  <span role="img" aria-label={country}>
                    {flagEmoji(post.countryCode)}
                  </span>
                </span>
                <span aria-hidden="true">•</span>
                <time dateTime={post.createdAt.toISOString()}>{format.relativeTime(post.createdAt, now)}</time>
              </p>
            </div>
          </div>
          {/* Badge : type de récit du post (table archetype). */}
          <span className="shrink-0 rounded-lg bg-canvas px-2 py-1 font-display text-label-md text-ink-soft/70">
            {tArchetypes(post.archetype)}
          </span>
        </div>

        <div className="relative mb-5 h-64 overflow-hidden rounded-lg bg-surface-muted sm:h-105">
          <Image
            src={post.photoUrl}
            alt={post.photoAlt}
            fill
            preload={preload}
            sizes="(min-width: 808px) 712px, calc(100vw - 32px)"
            className="object-cover transition duration-500 ease-out hover:scale-[1.01]"
          />
        </div>

        <div className="mb-5">
          <h2 className="mb-2 font-display text-headline-sm text-ink">{post.title}</h2>
          <p className="text-body-md text-ink-soft">{post.shortDescription}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {/* État chargé pour toute la page par FeedList (store partagé), pas d'appel par carte. */}
          <PostReactions postId={post.id} initialLikeCount={post.likeCount} loadViewer={false} />
          <Link href={`/post/${post.id}`} className={buttonClassName("sm", "ml-auto")}>
            <Icon name="sparkles" className="size-4" />
            {t("cta")}
          </Link>
        </div>
      </article>
    </Card>
  );
}

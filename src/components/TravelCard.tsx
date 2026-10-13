import Image from "next/image";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import type { FeedPost } from "@/lib/posts";

type TravelCardProps = {
  post: FeedPost;
  // Instant de référence pour « il y a 2 heures » (le même pour toute la liste).
  now: Date;
  // Précharger l'image (premier post visible à l'écran).
  preload?: boolean;
};

// Drapeau emoji à partir du code pays ISO (ex. « JP » → 🇯🇵).
function flagEmoji(countryCode: string) {
  return String.fromCodePoint(...[...countryCode].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

// Carte d'un post dans le feed.
export async function TravelCard({ post, now, preload = false }: TravelCardProps) {
  const t = await getTranslations("TravelCard");
  const format = await getFormatter();
  const countryName = new Intl.DisplayNames([await getLocale()], { type: "region" }).of(post.countryCode);

  return (
    <Card className="p-4 shadow-xs transition hover:border-ink-soft/25 sm:p-6">
      <article>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={post.author.avatarUrl} alt="" size={40} />
            <div className="min-w-0">
              <p className="mb-1 font-display text-label-lg text-ink">{post.author.displayName}</p>
              <p className="flex flex-wrap items-center gap-1 text-body-sm text-ink-soft/70">
                <span>
                  {post.location}{" "}
                  <span role="img" aria-label={countryName}>
                    {flagEmoji(post.countryCode)}
                  </span>
                </span>
                <span aria-hidden="true">•</span>
                <time dateTime={post.createdAt.toISOString()}>{format.relativeTime(post.createdAt, now)}</time>
              </p>
            </div>
          </div>
          {post.tag && (
            <span className="shrink-0 rounded-lg bg-canvas px-2 py-1 font-display text-label-md text-ink-soft/70">
              {post.tag}
            </span>
          )}
        </div>

        <div className="relative mb-5 h-64 overflow-hidden rounded-lg bg-surface-muted sm:h-105">
          <Image
            src={post.imageUrl}
            alt={post.imageAlt}
            fill
            preload={preload}
            sizes="(min-width: 808px) 712px, calc(100vw - 32px)"
            className="object-cover transition duration-500 ease-out hover:scale-[1.01]"
          />
        </div>

        <div className="mb-5">
          <h2 className="mb-2 font-display text-headline-sm text-ink">{post.title}</h2>
          <p className="text-body-md text-ink-soft">{post.content}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {post.highlight && <span className="text-body-sm text-ink-soft/70">{post.highlight}</span>}
          <Link href={`/post/${post.id}`} className={buttonClassName("sm", "ml-auto")}>
            <Icon name="sparkles" className="size-4" />
            {t("cta")}
          </Link>
        </div>
      </article>
    </Card>
  );
}

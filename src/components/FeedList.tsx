"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TravelCard } from "@/components/TravelCard";
import { Button } from "@/components/ui/Button";
import type { FeedPost, PostArchetype } from "@/lib/posts";

type FeedListProps = {
  // Première page, rendue par le serveur.
  initialPosts: FeedPost[];
  initialCursor: number | null;
  archetype?: PostArchetype;
  // Instant de référence des dates relatives (le même que celui du rendu serveur).
  now: Date;
};

// Distance avant le bas de la liste à laquelle la page suivante est demandée.
const PRELOAD_MARGIN = "600px";

// Liste du feed avec chargement infini : la page suivante (GET /api/v1/posts?cursor=…)
// est chargée quand le bas de la liste approche de l'écran.
export function FeedList({ initialPosts, initialCursor, archetype, now }: FeedListProps) {
  const t = useTranslations("Home");
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const sentinel = useRef<HTMLDivElement>(null);

  async function loadMore() {
    if (cursor === null) return;
    setStatus("loading");

    const params = new URLSearchParams({ cursor: String(cursor) });
    if (archetype) params.set("archetype", archetype);
    const response = await fetch(`/api/v1/posts?${params}`).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;

    if (!data) return setStatus("error");

    // Les dates arrivent en texte (JSON) ; un post déjà affiché n'est pas ajouté deux fois.
    const next = (data.posts as (Omit<FeedPost, "createdAt"> & { createdAt: string })[]).map((post) => ({
      ...post,
      createdAt: new Date(post.createdAt),
    }));
    setPosts((current) => [...current, ...next.filter((post) => !current.some(({ id }) => id === post.id))]);
    setCursor(data.nextCursor as number | null);
    setStatus("idle");
  }

  const onSentinelVisible = useEffectEvent(() => {
    loadMore();
  });

  // Observe le bas de la liste tant qu'il reste des posts et qu'aucun chargement n'est en cours.
  useEffect(() => {
    const element = sentinel.current;
    if (!element || cursor === null || status !== "idle") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onSentinelVisible();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [cursor, status]);

  return (
    <>
      <div className="space-y-12">
        {posts.map((post, index) => (
          <TravelCard key={post.id} post={post} now={now} preload={index === 0} />
        ))}
      </div>

      <div ref={sentinel} aria-hidden="true" />

      <div className="flex flex-col items-center gap-3 py-10 text-center text-body-md text-ink-soft">
        <p role="status" aria-live="polite">
          {status === "loading" && t("loadingMore")}
          {status === "error" && t("loadMoreError")}
          {status === "idle" && cursor === null && t("end")}
        </p>
        {status === "error" && (
          <Button size="sm" onClick={loadMore}>
            {t("retry")}
          </Button>
        )}
      </div>
    </>
  );
}

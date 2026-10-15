"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TravelCard } from "@/components/TravelCard";
import { Button } from "@/components/ui/Button";
import type { FeedPost } from "@/lib/posts";
import { setReactionFromServer, type ReactionState } from "@/client/reactions-store";
import { apiFetch, getSessionSnapshot } from "@/client/session";

type FeedListProps = {
  initialPosts: FeedPost[];
  initialCursor: number | null;
  archetype?: string;
  // Même instant que le rendu serveur (dates relatives identiques).
  now: Date;
};

const PRELOAD_MARGIN = "600px";
// Même limite que MAX_REACTION_POST_IDS côté serveur.
const MAX_REACTION_IDS = 50;

// Chargement infini : la page suivante arrive quand le bas de la liste approche.
export function FeedList({ initialPosts, initialCursor, archetype, now }: FeedListProps) {
  const t = useTranslations("Home");
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const sentinel = useRef<HTMLDivElement>(null);
  const requested = useRef(new Set<number>());

  useEffect(() => {
    if (!getSessionSnapshot()) return;
    const ids = posts.map(({ id }) => id).filter((id) => !requested.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => requested.current.add(id));

    for (let start = 0; start < ids.length; start += MAX_REACTION_IDS) {
      const batch = ids.slice(start, start + MAX_REACTION_IDS);
      apiFetch<{ reactions: ({ postId: number } & ReactionState)[] }>(
        `/api/v1/users/me/reactions?postIds=${batch.join(",")}`,
      ).then((result) => {
        if ("error" in result) return;
        for (const { postId, ...state } of result.data.reactions) setReactionFromServer(postId, state);
      });
    }
  }, [posts]);

  async function loadMore() {
    if (cursor === null) return;
    setStatus("loading");

    const params = new URLSearchParams({ cursor: String(cursor) });
    if (archetype) params.set("archetype", archetype);
    const response = await fetch(`/api/v1/posts?${params}`).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;

    if (!data) return setStatus("error");

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

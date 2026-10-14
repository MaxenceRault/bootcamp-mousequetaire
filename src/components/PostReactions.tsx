"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  getReaction,
  setReactionFromServer,
  setReactionFromUser,
  subscribeReactions,
  type ReactionState,
} from "@/lib/reactions-store";
import { apiFetch, getSessionSnapshot, subscribeSession } from "@/lib/session";

type Kind = "like" | "save";

type PostReactionsProps = {
  postId: number;
  // Nombre de likes rendu par le serveur, affiché tant que le store n'a rien de plus récent.
  initialLikeCount: number;
  // false : le parent charge l'état pour plusieurs posts à la fois (feed) ; pas d'appel par post.
  loadViewer?: boolean;
};

// Boutons « J'aime » et « Enregistrer » d'un post (utilisateur connecté).
// Visiteur : seul le nombre de likes est affiché, sans action possible.
// L'état vient du store partagé (lib/reactions-store) : il reste synchronisé entre les pages,
// entre plusieurs cartes du même post et entre les onglets.
// Mise à jour optimiste : l'interface change tout de suite et revient en arrière si l'API refuse.
export function PostReactions({ postId, initialLikeCount, loadViewer = true }: PostReactionsProps) {
  const t = useTranslations("Post");
  const router = useRouter();
  const [pending, setPending] = useState<Kind | null>(null);
  const stored = useSyncExternalStore(
    subscribeReactions,
    () => getReaction(postId),
    () => undefined,
  );
  const reactions: ReactionState = stored ?? { likeCount: initialLikeCount, liked: false, saved: false };
  // Session du navigateur (le token n'est pas dans un cookie) : inconnue pendant le rendu serveur.
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);

  // Page détail : état de l'utilisateur connecté (et nombre de likes à jour) chargé via l'API.
  useEffect(() => {
    if (!loadViewer || !getSessionSnapshot()) return;
    let cancelled = false;

    apiFetch<ReactionState>(`/api/v1/posts/${postId}/reactions`).then((result) => {
      if (!cancelled && !("error" in result)) setReactionFromServer(postId, result.data);
    });

    return () => {
      cancelled = true;
    };
  }, [postId, loadViewer]);

  async function toggle(kind: Kind) {
    // Visiteur : il faut un compte pour aimer ou enregistrer.
    if (!getSessionSnapshot()) return router.push("/login");

    const previous = reactions;
    const active = kind === "like" ? !reactions.liked : !reactions.saved;
    setReactionFromUser(
      postId,
      kind === "like"
        ? { ...reactions, liked: active, likeCount: Math.max(0, reactions.likeCount + (active ? 1 : -1)) }
        : { ...reactions, saved: active },
    );

    setPending(kind);
    const result = await apiFetch<ReactionState>(`/api/v1/posts/${postId}/${kind}`, {
      method: active ? "PUT" : "DELETE",
    });
    setPending(null);

    if ("error" in result) {
      setReactionFromUser(postId, previous);
      if (result.error === "UNAUTHORIZED") router.push("/login");
      return;
    }
    setReactionFromUser(postId, result.data);
  }

  if (!session) {
    return (
      <p
        aria-label={t("likeCount", { count: reactions.likeCount })}
        className="inline-flex h-9 items-center gap-1.5 font-display text-label-md text-ink-soft"
      >
        <Icon name="heart" className="size-4" />
        <span aria-hidden="true">{reactions.likeCount}</span>
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={reactions.liked}
        aria-label={t(reactions.liked ? "unlike" : "like", { count: reactions.likeCount })}
        disabled={pending === "like"}
        onClick={() => toggle("like")}
      >
        <Icon name={reactions.liked ? "heartFilled" : "heart"} className={`size-4 ${reactions.liked ? "text-accent" : ""}`} />
        <span aria-hidden="true">{reactions.likeCount}</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={reactions.saved}
        disabled={pending === "save"}
        onClick={() => toggle("save")}
      >
        <Icon name={reactions.saved ? "bookmarkFilled" : "bookmark"} className={`size-4 ${reactions.saved ? "text-accent" : ""}`} />
        {t(reactions.saved ? "saved" : "save")}
      </Button>
    </div>
  );
}

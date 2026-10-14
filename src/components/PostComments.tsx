"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { RoleBadge } from "@/components/RoleBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClassName } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import type { UserRole } from "@/lib/roles";
import { apiFetch, getSessionSnapshot, parseSessionUser, subscribeSession } from "@/lib/session";

export type PostComment = {
  id: number;
  content: string;
  created_at: string;
  author: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    avatar_seed: string | null;
    avatar_background_color: string | null;
    role: UserRole;
  };
};

const COMMENT_MAX = 1000;
const ERRORS = ["INVALID_INPUT", "TOO_MANY_REQUESTS", "FORBIDDEN", "NOT_FOUND", "CONTENT_REJECTED", "INTERNAL_ERROR"] as const;
type CommentErrorCode = (typeof ERRORS)[number];
const MODERATION_REASONS = ["sexual", "violence", "hate", "insult", "politics", "blasphemy", "other"] as const;

// Lecture publique ; écrire demande d'être connecté. Supprimer : son propre commentaire, ou tout commentaire pour un admin.
export function PostComments({ postId, initialComments }: { postId: number; initialComments: PostComment[] }) {
  const t = useTranslations("Comments");
  const tModeration = useTranslations("PostEditor.moderation");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
  const user = parseSessionUser(session);
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ code: CommentErrorCode; reasons: string[] } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError(null);
    const result = await apiFetch<{ comment: PostComment }>(`/api/v1/posts/${postId}/comments`, {
      method: "POST",
      body: { content: draft },
    });
    setSending(false);

    if ("data" in result) {
      setComments((current) => [...current, result.data.comment]);
      return setDraft("");
    }
    if (result.error === "UNAUTHORIZED") return router.push("/login");
    setError({ code: ERRORS.find((code) => code === result.error) ?? "INTERNAL_ERROR", reasons: result.reasons ?? [] });
  }

  async function remove(commentId: number) {
    if (!window.confirm(t("deleteConfirm"))) return;
    const result = await apiFetch(`/api/v1/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
    if ("data" in result || result.error === "NOT_FOUND") {
      return setComments((current) => current.filter((comment) => comment.id !== commentId));
    }
    setError({ code: ERRORS.find((code) => code === result.error) ?? "INTERNAL_ERROR", reasons: [] });
  }

  const reasons = (error?.reasons ?? []).filter((reason): reason is (typeof MODERATION_REASONS)[number] =>
    (MODERATION_REASONS as readonly string[]).includes(reason),
  );

  return (
    <section aria-labelledby="comments-title" className="mt-10 flex flex-col gap-5 border-t border-line pt-8">
      <h2 id="comments-title" className="font-display text-headline-sm text-ink">
        {t("title", { count: comments.length })}
      </h2>

      {comments.length === 0 && <p className="text-body-md text-ink-soft">{t("empty")}</p>}

      <ul className="flex flex-col gap-4">
        {comments.map((comment) => {
          const canDelete = user && (user.id === comment.author.id || user.role === "admin");
          return (
            <li key={comment.id} className="flex gap-3">
              <Avatar
                src={comment.author.avatar_url}
                name={comment.author.avatar_seed ?? comment.author.id}
                backgroundColor={comment.author.avatar_background_color}
                alt=""
                size={40}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg bg-surface-muted px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-display text-label-lg text-ink">{comment.author.display_name}</span>
                  <RoleBadge role={comment.author.role} />
                  {/* Borné à maintenant : l'horloge du serveur peut avoir quelques secondes d'avance. */}
                  <span className="text-label-sm text-ink-soft">{format.relativeTime(new Date(Math.min(Date.parse(comment.created_at), now.getTime())), now)}</span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void remove(comment.id)}
                      aria-label={t("delete")}
                      className="ml-auto rounded-lg p-1 text-ink-soft transition hover:bg-surface hover:text-error"
                    >
                      <Icon name="delete" className="size-4" />
                    </button>
                  )}
                </div>
                {/* Texte brut, jamais interprété comme du HTML. */}
                <p className="text-body-md break-words whitespace-pre-line text-ink">{comment.content}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {user ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="comment-content" className="sr-only">
            {t("label")}
          </label>
          <Textarea
            id="comment-content"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            maxLength={COMMENT_MAX}
            placeholder={t("placeholder")}
            required
            className="min-h-24"
          />
          <FormError>
            {error &&
              [
                t(`errors.${error.code}`),
                reasons.length > 0 ? t("reasons", { list: reasons.map((reason) => tModeration(reason)).join(", ") }) : "",
              ].join(" ")}
          </FormError>
          <Button type="submit" disabled={sending || !draft.trim()} className="gap-2 self-end">
            <Icon name="send" className="size-4" />
            {sending ? t("sending") : t("submit")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted p-4">
          <p className="text-body-md text-ink-soft">{t("loginPrompt")}</p>
          <Link href="/login" className={buttonClassName("sm")}>
            {t("login")}
          </Link>
        </div>
      )}
    </section>
  );
}

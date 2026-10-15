"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import { apiFetch, getSessionSnapshot, parseSessionUser, subscribeSession } from "@/client/session";

type Status = "idle" | "open" | "sending" | "sent";

// Masqué pour l'auteur du récit ; un visiteur est envoyé vers la connexion.
export function ReportButton({ postId, authorId }: { postId: number; authorId: string }) {
  const t = useTranslations("Report");
  const router = useRouter();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState(false);
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
  const user = parseSessionUser(session);

  useEffect(() => {
    if (status !== "open") return;
    function handlePointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setStatus("idle");
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setStatus("idle");
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [status]);

  if (user?.id === authorId) return null;

  function toggle() {
    if (!getSessionSnapshot()) return router.push("/login");
    setError(false);
    setStatus((current) => (current === "open" ? "idle" : "open"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    setStatus("sending");
    setError(false);
    const result = await apiFetch(`/api/v1/posts/${postId}/report`, { method: "POST", body: { reason } });
    if ("data" in result) return setStatus("sent");
    if (result.error === "UNAUTHORIZED") return router.push("/login");
    setError(true);
    setStatus("open");
  }

  if (status === "sent") {
    return (
      <span role="status" className="inline-flex h-9 items-center gap-1.5 px-2 font-display text-label-md text-ink-soft">
        <Icon name="check" className="size-4" />
        {t("sent")}
      </span>
    );
  }

  return (
    <div ref={root} className="relative">
      <Button variant="secondary" size="sm" onClick={toggle} aria-expanded={status !== "idle"} aria-controls={panelId}>
        <Icon name="flag" className="size-4" />
        {t("button")}
      </Button>

      {status !== "idle" && (
        <form
          id={panelId}
          onSubmit={handleSubmit}
          className="absolute top-full right-0 z-50 mt-2 flex w-[min(90vw,320px)] flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-lg"
        >
          <div className="flex flex-col gap-1">
            <p className="font-display text-label-lg text-ink">{t("title")}</p>
            <p className="text-body-sm text-ink-soft">{t("hint")}</p>
          </div>
          <label htmlFor={`${panelId}-reason`} className="sr-only">
            {t("reasonLabel")}
          </label>
          <Textarea
            id={`${panelId}-reason`}
            name="reason"
            maxLength={500}
            placeholder={t("reasonPlaceholder")}
            className="min-h-20"
            autoFocus
          />
          {error && <FormError>{t("error")}</FormError>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStatus("idle")}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={status === "sending"}>
              {t("submit")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

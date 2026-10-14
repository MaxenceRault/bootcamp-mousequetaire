"use client";

import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import type { UserRole } from "@/lib/roles";
import { apiFetch } from "@/lib/session";
import {
  AVATAR_BACKGROUND_COLORS,
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_TYPES,
  USERNAME_PATTERN,
} from "@/schemas/user.schema";

export type EditableProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_seed: string | null;
  avatar_background_color: string | null;
  location: string | null;
  created_at: string;
  role: UserRole;
};

type ProfileEditFormProps = {
  user: EditableProfile;
  onSaved: (user: EditableProfile) => void;
  onCancel: () => void;
  // Photo ou fond enregistrés tout de suite, le formulaire reste ouvert.
  onImageChange: (user: EditableProfile) => void;
};

const AVATAR_CHOICES = 7;

export function ProfileEditForm({ user, onSaved, onCancel, onImageChange }: ProfileEditFormProps) {
  const t = useTranslations("Profile");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const currentSeed = user.avatar_seed ?? user.id;
  const [avatarSeed, setAvatarSeed] = useState(currentSeed);
  const [round, setRound] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState(user.avatar_background_color);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    const result = await apiFetch<{ user: EditableProfile }>("/api/v1/users/me", {
      method: "PATCH",
      body: {
        display_name: form.get("display_name"),
        username: form.get("username"),
        location: form.get("location"),
        // L'avatar par défaut (id) est stocké comme null.
        avatar_seed: avatarSeed === user.id ? null : avatarSeed,
        avatar_background_color: backgroundColor,
      },
    });
    setPending(false);

    if ("error" in result) return setError(t(`errors.${result.error}`));
    onSaved(result.data.user);
  }

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="mb-4 font-display text-headline-sm text-ink">{t("form.title")}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-4 border-b border-line pb-4">
          <legend className="mb-2 font-display text-label-md text-ink">{t("form.images")}</legend>
          <AvatarPhotoField
            user={user}
            label={t("form.photo")}
            hint={t("form.photoHint")}
            preview={
              <Avatar
                src={user.avatar_url}
                name={currentSeed}
                backgroundColor={backgroundColor}
                alt=""
                size={56}
              />
            }
            onChange={onImageChange}
          />
          <BackgroundColorPicker selected={backgroundColor} onSelect={setBackgroundColor} />
        </fieldset>

        {!user.avatar_url && (
          <AvatarPicker
            userId={user.id}
            currentSeed={currentSeed}
            selected={avatarSeed}
            round={round}
            onSelect={setAvatarSeed}
            onShuffle={() => setRound((r) => r + 1)}
            backgroundColor={backgroundColor}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-display-name" label={t("form.displayName")}>
            <Input
              id="profile-display-name"
              name="display_name"
              defaultValue={user.display_name}
              autoComplete="name"
              maxLength={60}
              required
            />
          </Field>

          <Field id="profile-username" label={t("form.username")}>
            <Input
              id="profile-username"
              name="username"
              defaultValue={user.username}
              autoComplete="username"
              pattern={USERNAME_PATTERN}
              title={t("form.usernameHint")}
              aria-describedby="profile-username-hint"
              minLength={3}
              maxLength={30}
              required
            />
            <p id="profile-username-hint" className="text-body-sm text-ink-soft/70">
              {t("form.usernameHint")}
            </p>
          </Field>
        </div>

        <Field id="profile-location" label={t("form.location")}>
          <Input
            id="profile-location"
            name="location"
            defaultValue={user.location ?? ""}
            placeholder={t("form.locationPlaceholder")}
            maxLength={80}
          />
        </Field>

        <FormError>{error}</FormError>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {t("form.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

type AvatarPickerProps = {
  userId: string;
  currentSeed: string;
  selected: string;
  round: number;
  onSelect: (seed: string) => void;
  onShuffle: () => void;
  backgroundColor: string | null;
};

// Propositions dérivées de l'id et du numéro de tirage : stables et propres à chaque utilisateur.
function AvatarPicker({ userId, currentSeed, selected, round, onSelect, onShuffle, backgroundColor }: AvatarPickerProps) {
  const t = useTranslations("Profile");
  const proposals = Array.from({ length: AVATAR_CHOICES }, (_, i) => `${userId}-${round}-${i}`);
  const choices = [...new Set([currentSeed, selected, ...proposals])];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-display text-label-md text-ink">{t("form.avatar")}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {choices.map((seed, index) => (
          <label
            key={seed}
            className="cursor-pointer rounded-xl p-1 ring-2 ring-transparent transition hover:ring-line has-checked:ring-accent has-focus-visible:ring-accent/40"
          >
            <input
              type="radio"
              name="avatar_choice"
              value={seed}
              checked={selected === seed}
              onChange={() => onSelect(seed)}
              className="sr-only"
            />
            <Avatar
              src={null}
              name={seed}
              backgroundColor={backgroundColor}
              alt={seed === currentSeed ? t("form.avatarCurrent") : t("form.avatarOption", { number: index + 1 })}
              size={56}
            />
          </label>
        ))}
        <Button variant="secondary" size="sm" onClick={onShuffle}>
          <Icon name="refresh" className="size-4" />
          {t("form.avatarShuffle")}
        </Button>
      </div>
    </fieldset>
  );
}

const IMAGE_ERRORS = ["INVALID_INPUT", "PAYLOAD_TOO_LARGE", "LENGTH_REQUIRED", "TOO_MANY_REQUESTS", "UNAUTHORIZED"] as const;

type AvatarPhotoFieldProps = {
  user: EditableProfile;
  label: string;
  hint: string;
  preview: ReactNode;
  onChange: (user: EditableProfile) => void;
};

function AvatarPhotoField({ user, label, hint, preview, onChange }: AvatarPhotoFieldProps) {
  const t = useTranslations("Profile");
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = user.avatar_url;
  const path = "/api/v1/users/me/avatar";

  async function send(body?: FormData) {
    setPending(true);
    setError(null);
    const result = await apiFetch<{ user: EditableProfile }>(path, body ? { method: "PUT", body } : { method: "DELETE" });
    setPending(false);
    if (input.current) input.current.value = "";

    if ("error" in result) {
      const code = IMAGE_ERRORS.find((known) => known === result.error) ?? "INTERNAL_ERROR";
      return setError(t(`errors.${code}`));
    }
    onChange(result.data.user);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // Contrôle rapide ; le serveur revérifie la taille et le type réel.
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      event.target.value = "";
      return setError(t("errors.PAYLOAD_TOO_LARGE"));
    }
    const body = new FormData();
    body.append("image", file);
    send(body);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4">
        {preview}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-label-md text-ink">{label}</span>
          <span className="text-body-sm text-ink-soft/70">{hint}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={PROFILE_IMAGE_TYPES.join(",")}
            className="peer sr-only"
            disabled={pending}
            onChange={handleFile}
          />
          <label
            htmlFor={inputId}
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-muted px-3.5 font-display text-label-md text-ink transition peer-focus-visible:ring-4 peer-focus-visible:ring-accent/25 hover:bg-surface ${pending ? "pointer-events-none opacity-50" : ""}`}
          >
            <Icon name="image" className="size-4" />
            {pending ? t("form.uploading") : t("form.chooseImage")}
          </label>
          {current && (
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => send()}>
              {t("form.removeImage")}
            </Button>
          )}
        </div>
      </div>
      <FormError>{error}</FormError>
    </div>
  );
}

// Palette fixe, validée aussi côté serveur.
function BackgroundColorPicker({ selected, onSelect }: { selected: string | null; onSelect: (color: string | null) => void }) {
  const t = useTranslations("Profile");
  const choices: (string | null)[] = [null, ...AVATAR_BACKGROUND_COLORS];

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-display text-label-md text-ink">{t("form.backgroundColor")}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((color, index) => (
          <label
            key={color ?? "none"}
            className="cursor-pointer rounded-lg p-0.5 ring-2 ring-transparent transition hover:ring-line has-checked:ring-accent has-focus-visible:ring-accent/40"
          >
            <input
              type="radio"
              name="avatar_background_color"
              value={color ?? ""}
              checked={selected === color}
              onChange={() => onSelect(color)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              style={{ backgroundColor: color ?? undefined }}
              className={`block size-8 rounded-md border border-line ${color ? "" : "bg-surface-muted"}`}
            />
            <span className="sr-only">{color ? t("form.colorOption", { number: index }) : t("form.noColor")}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

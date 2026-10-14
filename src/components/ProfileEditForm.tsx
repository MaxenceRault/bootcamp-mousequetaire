"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { apiFetch } from "@/lib/session";
import { USERNAME_PATTERN } from "@/schemas/user.schema";

export type EditableProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar_seed: string | null;
  location: string | null;
  created_at: string;
};

type ProfileEditFormProps = {
  user: EditableProfile;
  onSaved: (user: EditableProfile) => void;
  onCancel: () => void;
};

// Nombre de nouveaux blobatars proposés à chaque « Autres propositions ».
const AVATAR_CHOICES = 7;

// Formulaire de modification du profil : PATCH /api/v1/users/me.
export function ProfileEditForm({ user, onSaved, onCancel }: ProfileEditFormProps) {
  const t = useTranslations("Profile");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Avatar actuel : le seed choisi, sinon l'id (avatar par défaut).
  const currentSeed = user.avatar_seed ?? user.id;
  const [avatarSeed, setAvatarSeed] = useState(currentSeed);
  const [round, setRound] = useState(0);

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
        {/* Le choix du blobatar n'a de sens que sans photo de profil. */}
        {!user.avatar_url && (
          <AvatarPicker
            userId={user.id}
            currentSeed={currentSeed}
            selected={avatarSeed}
            round={round}
            onSelect={setAvatarSeed}
            onShuffle={() => setRound((r) => r + 1)}
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
};

// Choix du blobatar : l'avatar actuel, celui sélectionné, puis des propositions.
// Les propositions sont dérivées de l'id et du numéro de tirage : pas d'aléatoire, et
// chaque utilisateur a ses propres propositions.
function AvatarPicker({ userId, currentSeed, selected, round, onSelect, onShuffle }: AvatarPickerProps) {
  const t = useTranslations("Profile");
  const proposals = Array.from({ length: AVATAR_CHOICES }, (_, i) => `${userId}-${round}-${i}`);
  const choices = [...new Set([currentSeed, selected, ...proposals])];

  return (
    <fieldset className="flex flex-col gap-2">
      {/* Même style que Label : un groupe de boutons radio se titre avec <legend>. */}
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

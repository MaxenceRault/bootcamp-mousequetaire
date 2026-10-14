"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Autocomplete, type Suggestion } from "@/components/ui/Autocomplete";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Label } from "@/components/ui/Label";
import { FIELD_CLASS_NAME, Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TripContextBar } from "@/components/TripContextBar";
import type { PostArchetype } from "@/lib/posts";
import { apiFetch, getSessionSnapshot } from "@/lib/session";
import { usePlaceSearch, type Place } from "@/lib/usePlaceSearch";


type PostEditorFormProps = {
  // Slugs des types de récit (libellés dans le namespace « Archetypes » de fr.json).
  archetypes: readonly PostArchetype[];
};

// Limites alignées sur les colonnes de la table post (title 100, photo_alt 200, short_description 252).
const TITLE_MAX = 100;
const PHOTO_ALT_MAX = 200;
const SHORT_DESCRIPTION_MAX = 252;
const PHOTO_TYPES = "image/jpeg,image/png,image/webp";
// Codes d'erreur de POST /api/v1/posts traduits dans fr.json (PostEditor.errors) ; les autres → INTERNAL_ERROR.
const API_ERRORS = ["INVALID_INPUT", "TOO_MANY_REQUESTS", "PAYLOAD_TOO_LARGE", "INTERNAL_ERROR"] as const;
type ApiError = (typeof API_ERRORS)[number];

export function PostEditorForm({ archetypes }: PostEditorFormProps) {
  const t = useTranslations("PostEditor");
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  // Page réservée aux utilisateurs connectés : sans session valide, direction la connexion.
  // (Confort uniquement : la vraie protection est la vérification du JWT par l'API.)
  useEffect(() => {
    if (!getSessionSnapshot()) router.replace("/login");
  }, [router]);

  // Libère l'URL temporaire de l'aperçu quand elle change ou quand le formulaire disparaît.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function removePhoto() {
    if (photoInput.current) photoInput.current.value = "";
    setPhotoPreview(null);
  }

  // Envoi multipart à POST /api/v1/posts : les noms des champs du formulaire suivent le schéma Zod.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = new FormData(event.currentTarget);

    setPending(true);
    setError(null);
    const result = await apiFetch<{ id: number }>("/api/v1/posts", { method: "POST", body });
    setPending(false);

    if ("error" in result) {
      // Token absent, expiré ou falsifié (apiFetch a déjà effacé la session) : retour à la connexion.
      if (result.error === "UNAUTHORIZED") return router.push("/login");
      return setError(API_ERRORS.find((code) => code === result.error) ?? "INTERNAL_ERROR");
    }
    // Ouvre le récit publié.
    router.push(`/post/${result.data.id}`);
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-10">
      {/* 1. Titre */}
      <div>
        <Label htmlFor="post-title" className="sr-only">
          {t("fields.title")}
        </Label>
        <textarea
          id="post-title"
          name="title"
          rows={1}
          maxLength={TITLE_MAX}
          placeholder={t("fields.titlePlaceholder")}
          required
          className="field-sizing-content w-full resize-none bg-transparent font-display text-display-lg-mobile text-ink placeholder:text-ink-soft/40 focus:outline-none md:text-display-lg"
        />
      </div>

      {/* 2. Barre de contexte : destination, dates, type de récit */}
      <TripContextBar idPrefix="post" archetypes={archetypes} />

      {/* 3. Photo de couverture : un seul upload */}
      <section aria-labelledby="post-photo-title" className="flex flex-col gap-2">
        <SectionTitle id="post-photo-title" icon="image">
          {t("photo.title")}
        </SectionTitle>
        <Card className="flex flex-col gap-4 p-4">
          {/* Toujours rendu (même avec l'aperçu affiché) pour que le fichier parte avec le formulaire. */}
          <input
            ref={photoInput}
            id="post-photo"
            name="photo"
            type="file"
            accept={PHOTO_TYPES}
            onChange={handlePhotoChange}
            required
            className="peer sr-only"
          />
          {photoPreview ? (
            <div className="relative aspect-2/1 overflow-hidden rounded-lg bg-surface-muted">
              {/* Aperçu local (URL blob) : pas d'optimisation d'image possible. */}
              <Image src={photoPreview} alt={t("photo.previewAlt")} fill unoptimized className="object-cover" />
              <button
                type="button"
                onClick={removePhoto}
                aria-label={t("photo.remove")}
                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg bg-surface/90 text-error transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
              >
                <Icon name="delete" className="size-4.5" />
              </button>
            </div>
          ) : (
            <label
              htmlFor="post-photo"
              className="flex aspect-2/1 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg bg-surface-muted transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent/25 hover:bg-line/40"
            >
              <span className="mb-1 flex size-11 items-center justify-center rounded-lg bg-surface text-accent shadow-sm">
                <Icon name="image" className="size-6" />
              </span>
              <span className="font-display text-label-md text-ink">{t("photo.add")}</span>
              <span className="text-body-sm text-ink-soft">{t("photo.hint")}</span>
            </label>
          )}

          {/* Texte alternatif : décrit la photo pour les lecteurs d'écran (colonne photo_alt). */}
          <Field id="post-photo-alt" label={t("photo.alt")}>
            <Input
              id="post-photo-alt"
              name="photoAlt"
              maxLength={PHOTO_ALT_MAX}
              placeholder={t("photo.altPlaceholder")}
              required
            />
          </Field>
        </Card>
      </section>

      {/* 4. Descriptions courte et longue */}
      <Card className="flex flex-col gap-6 p-6 md:p-10">
        <Field id="post-short-description" label={t("fields.shortDescription")}>
          <Textarea
            id="post-short-description"
            name="shortDescription"
            maxLength={SHORT_DESCRIPTION_MAX}
            placeholder={t("fields.shortDescriptionPlaceholder")}
            required
            className="min-h-24"
          />
        </Field>

        <Field id="post-long-description" label={t("fields.longDescription")}>
          <Textarea
            id="post-long-description"
            name="longDescription"
            placeholder={t("fields.longDescriptionPlaceholder")}
            required
            className="min-h-64"
          />
        </Field>
      </Card>

      {/* 5. Tags */}
      <section aria-labelledby="post-tags-title" className="flex flex-col gap-2">
        <SectionTitle id="post-tags-title" icon="check">
          {t("tags.title")}
        </SectionTitle>
        <Card className="p-4">
          <TagsField />
        </Card>
      </section>

      <div className="flex flex-col items-end gap-3">
        <FormError>{error && t(`errors.${error}`)}</FormError>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}

// Tags : des lieux (pays ou villes) choisis dans les suggestions, affichés en pastilles.
function TagsField() {
  const t = useTranslations("PostEditor");
  const { query, places, error, changeQuery, reset } = usePlaceSearch();
  const [selected, setSelected] = useState<Place[]>([]);

  // Les lieux déjà ajoutés ne sont plus proposés.
  const suggestions = places
    .filter((place) => !selected.some((tag) => tag.key === place.key))
    .map(({ key, label }) => ({ key, label }));

  function addTag({ key }: Suggestion) {
    const place = places.find((option) => option.key === key);
    if (place) setSelected((current) => [...current, place]);
    reset();
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {selected.map((tag) => {
            // Nom court sur la pastille (ville ou pays), nom complet en infobulle.
            const name = tag.city ?? tag.label;

            return (
              <li key={tag.key}>
                <button
                  type="button"
                  title={tag.label}
                  onClick={() => setSelected((current) => current.filter(({ key }) => key !== tag.key))}
                  aria-label={t("tags.remove", { name: tag.label })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 font-display text-label-md text-surface transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
                >
                  #{name}
                  <Icon name="close" className="size-3.5" />
                </button>
                {/* Chaque tag part avec le formulaire (un champ « tags » par lieu, revalidé côté serveur). */}
                <input
                  type="hidden"
                  name="tags"
                  value={JSON.stringify({ country: tag.country, state: tag.state, city: tag.city })}
                />
              </li>
            );
          })}
        </ul>
      )}
      <Autocomplete
        aria-label={t("tags.inputLabel")}
        value={query}
        onValueChange={changeQuery}
        suggestions={suggestions}
        onSelect={addTag}
        placeholder={t("tags.placeholder")}
        className={`h-11 ${FIELD_CLASS_NAME}`}
      />
      {error && <FormError>{t("placesError")}</FormError>}
    </div>
  );
}

function SectionTitle({ id, icon, children }: { id: string; icon: IconName; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 font-display text-headline-sm text-ink">
      <Icon name={icon} className="size-5 text-ink-soft" />
      {children}
    </h2>
  );
}

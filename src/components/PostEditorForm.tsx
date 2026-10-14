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
import type { PostArchetype } from "@/lib/posts";
import { apiFetch, getSessionSnapshot } from "@/lib/session";


// Lieu renvoyé par GET /api/v1/locations?q=… (pays, ou ville avec sa région et son pays).
type Place = { key: string; label: string; country: string; state?: string; city?: string };

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

// Attente après la dernière frappe avant de lancer une recherche de lieu.
const SEARCH_DELAY_MS = 250;

// Champs transparents de la barre de contexte (destination, dates, type de récit).
const CONTEXT_INPUT_CLASS_NAME =
  "w-full min-w-0 bg-transparent text-body-md font-medium text-ink placeholder:text-ink-soft/50 focus:outline-none";

export function PostEditorForm({ archetypes }: PostEditorFormProps) {
  const t = useTranslations("PostEditor");
  const tArchetypes = useTranslations("Archetypes");
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
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
      <Card className="grid grid-cols-1 gap-2 p-2 md:grid-cols-3">
        <ContextField icon="pin" label={t("fields.destination")} htmlFor="post-destination">
          <DestinationField />
        </ContextField>

        <ContextField icon="calendar" label={t("fields.timeline")}>
          <div className="flex items-center gap-1">
            <input
              name="startDate"
              type="date"
              aria-label={t("fields.startDate")}
              value={startDate}
              onChange={(event) => setStartDate(event.currentTarget.value)}
              required
              className={CONTEXT_INPUT_CLASS_NAME}
            />
            <span aria-hidden="true" className="text-ink-soft">
              →
            </span>
            {/* La date de fin ne peut pas précéder la date de début. */}
            <input
              name="endDate"
              type="date"
              aria-label={t("fields.endDate")}
              min={startDate || undefined}
              required
              className={CONTEXT_INPUT_CLASS_NAME}
            />
          </div>
        </ContextField>

        <ContextField icon="category" label={t("fields.archetype")} htmlFor="post-archetype">
          <select
            id="post-archetype"
            name="archetype"
            defaultValue=""
            required
            className={`cursor-pointer ${CONTEXT_INPUT_CLASS_NAME}`}
          >
            <option value="" disabled>
              {t("fields.archetypePlaceholder")}
            </option>
            {archetypes.map((archetype) => (
              <option key={archetype} value={archetype}>
                {tArchetypes(archetype)}
              </option>
            ))}
          </select>
        </ContextField>
      </Card>

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

// Recherche de lieux (GET /api/v1/locations?q=…) pendant la saisie, partagée par la destination et les tags.
function usePlaceSearch() {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Numéro de la dernière recherche : une réponse plus ancienne (frappe rapide) est ignorée.
  const lastRequest = useRef(0);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function changeQuery(value: string) {
    setQuery(value);
    setError(false);
    clearTimeout(searchTimer.current);

    if (value.trim().length < 2) {
      lastRequest.current++;
      setPlaces([]);
      return;
    }
    searchTimer.current = setTimeout(() => search(value.trim()), SEARCH_DELAY_MS);
  }

  async function search(text: string) {
    const requestId = ++lastRequest.current;
    const response = await fetch(`/api/v1/locations?${new URLSearchParams({ q: text })}`).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => null) : null;
    if (requestId !== lastRequest.current) return;

    setError(!data);
    setPlaces((data?.places as Place[] | undefined) ?? []);
  }

  // Après un choix : vide les suggestions et remplace le texte saisi.
  function reset(nextQuery = "") {
    clearTimeout(searchTimer.current);
    lastRequest.current++;
    setQuery(nextQuery);
    setPlaces([]);
  }

  return { query, places, error, changeQuery, reset };
}

// Destination : un lieu à choisir dans les suggestions.
// Seul un lieu choisi dans la liste est accepté : il part dans des champs cachés (pays, région, ville).
function DestinationField() {
  const t = useTranslations("PostEditor");
  const input = useRef<HTMLInputElement>(null);
  const { query, places, error, changeQuery, reset } = usePlaceSearch();
  const [selected, setSelected] = useState<Place | null>(null);

  // Texte saisi sans choisir de suggestion : le navigateur bloque l'envoi avec ce message.
  useEffect(() => {
    input.current?.setCustomValidity(query && !selected ? t("fields.destinationPick") : "");
  }, [query, selected, t]);

  function handleSelect({ key }: Suggestion) {
    const place = places.find((option) => option.key === key);
    if (!place) return;
    setSelected(place);
    reset(place.label);
  }

  return (
    <>
      <Autocomplete
        ref={input}
        id="post-destination"
        value={query}
        onValueChange={(value) => {
          changeQuery(value);
          setSelected(null);
        }}
        suggestions={places.map(({ key, label }) => ({ key, label }))}
        onSelect={handleSelect}
        placeholder={t("fields.destinationPlaceholder")}
        required
        className={`truncate ${CONTEXT_INPUT_CLASS_NAME}`}
      />
      {selected && (
        <>
          <input type="hidden" name="destinationCountry" value={selected.country} />
          {selected.state && <input type="hidden" name="destinationState" value={selected.state} />}
          {selected.city && <input type="hidden" name="destinationCity" value={selected.city} />}
        </>
      )}
      {error && <FormError>{t("placesError")}</FormError>}
    </>
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

// Case de la barre de contexte : icône + petit label en capitales + champ transparent.
function ContextField({
  icon,
  label,
  htmlFor,
  children,
}: {
  icon: IconName;
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 transition focus-within:ring-2 focus-within:ring-accent/25">
      <Icon name={icon} className="size-5 text-ink-soft" />
      <div className="flex min-w-0 flex-1 flex-col">
        <label htmlFor={htmlFor} className="font-display text-label-sm text-ink-soft uppercase">
          {label}
        </label>
        {children}
      </div>
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

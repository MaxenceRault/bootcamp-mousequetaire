"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { FormError } from "@/components/ui/FormError";
import { Icon, type IconName } from "@/components/ui/Icon";
import { FIELD_CLASS_NAME, Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { countryName, flagEmoji } from "@/lib/country";
import type { PostArchetype } from "@/lib/posts";
import { apiFetch, getSessionSnapshot } from "@/lib/session";

// ─── Types de l'API (GET /api/v1/trips/[id]) ────────────────────────────────

const ITEM_CATEGORIES = ["transport", "lodging", "activity", "food"] as const;
type ItemCategory = (typeof ITEM_CATEGORIES)[number];

type Trip = {
  id: number;
  title: string;
  destination_country_code: string;
  destination_city: string | null;
  start_date: string;
  end_date: string;
  archetype: PostArchetype;
  budget_lodging: number;
  budget_transit: number;
  budget_dining: number;
  budget_activities: number;
  budget_target: number | null;
  source_post_count: number;
  generated_at: string | null;
};

type TripItem = {
  id: number;
  day: string;
  start_time: string;
  title: string;
  description: string | null;
  category: ItemCategory;
  source_post: { id: number; title: string; slug: string } | null;
};

type TripTask = { id: number; label: string; detail: string | null; done: boolean };

type TripDetail = { trip: Trip; items: TripItem[]; tasks: TripTask[] };

// GET / POST /api/v1/trips/[id]/messages
type TripSuggestion = Omit<TripItem, "id"> & { id: number; status: "pending" | "accepted" | "rejected" };

type TripMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  off_topic: boolean;
  suggestions: TripSuggestion[];
};

// Limites de la discussion (alignées sur trip.schema et trip.service).
const CHAT_MESSAGE_MAX = 500;
const CHAT_MAX_USER_MESSAGES = 50;

// Codes d'erreur de l'API traduits dans fr.json (Planner.errors) ; les autres → INTERNAL_ERROR.
const PLANNER_ERRORS = [
  "INVALID_INPUT",
  "TRIP_TOO_LONG",
  "TOO_MANY_REQUESTS",
  "AI_UNAVAILABLE",
  "CHAT_LIMIT_REACHED",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "INTERNAL_ERROR",
] as const;
export type PlannerError = (typeof PLANNER_ERRORS)[number];

export function plannerError(code: string): PlannerError {
  return (PLANNER_ERRORS as readonly string[]).includes(code) ? (code as PlannerError) : "INTERNAL_ERROR";
}

const CATEGORY_ICONS: Record<ItemCategory, IconName> = {
  transport: "train",
  lodging: "hotel",
  activity: "explore",
  food: "restaurant",
};

const BUDGET_FIELDS = [
  { key: "budget_lodging", body: "budgetLodging", label: "lodging" },
  { key: "budget_transit", body: "budgetTransit", label: "transit" },
  { key: "budget_dining", body: "budgetDining", label: "dining" },
  { key: "budget_activities", body: "budgetActivities", label: "activities" },
] as const;

// Jour « AAAA-MM-JJ » à midi local : la date affichée ne glisse pas selon le fuseau horaire.
function parseDay(day: string) {
  return new Date(`${day}T12:00:00`);
}

// Tous les jours du voyage, du premier au dernier.
function tripDays(start: string, end: string) {
  const days: string[] = [];
  for (let date = parseDay(start); date <= parseDay(end); date.setDate(date.getDate() + 1)) {
    days.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
  }
  return days;
}

function budgetTotal(trip: Trip) {
  return trip.budget_lodging + trip.budget_transit + trip.budget_dining + trip.budget_activities;
}

// Appel d'une route du voyage : renvoie le voyage à jour, ou un code d'erreur.
type Mutate = (path: string, method: string, body?: unknown) => Promise<boolean>;

// ─── Page ───────────────────────────────────────────────────────────────────

type LoadState = { status: "loading" } | { status: "error"; error: PlannerError } | { status: "ready"; data: TripDetail };

export function TripPlanner({ tripId }: { tripId: number }) {
  const t = useTranslations("Planner");
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [error, setError] = useState<PlannerError | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const basePath = `/api/v1/trips/${tripId}`;

  useEffect(() => {
    if (!getSessionSnapshot()) return router.replace("/login");

    apiFetch<TripDetail>(`/api/v1/trips/${tripId}`).then((result) => {
      if ("data" in result) return setState({ status: "ready", data: result.data });
      if (result.error === "UNAUTHORIZED") return router.replace("/login");
      setState({ status: "error", error: plannerError(result.error) });
    });
  }, [router, tripId]);

  const mutate: Mutate = async (path, method, body) => {
    setError(null);
    const result = await apiFetch<TripDetail>(`${basePath}${path}`, { method, body });
    if ("data" in result) {
      setState({ status: "ready", data: result.data });
      return true;
    }
    if (result.error === "UNAUTHORIZED") router.replace("/login");
    setError(plannerError(result.error));
    return false;
  };

  async function regenerate() {
    if (!window.confirm(t("trip.regenerateConfirm"))) return;
    setRegenerating(true);
    await mutate("/regenerate", "POST");
    setRegenerating(false);
  }

  async function handleDelete() {
    if (!window.confirm(t("trip.deleteConfirm"))) return;
    setError(null);
    const result = await apiFetch(basePath, { method: "DELETE" });
    if ("data" in result || result.error === "NOT_FOUND") return router.push("/planner");
    setError(plannerError(result.error));
  }

  if (state.status === "loading") return <PlannerSkeleton />;
  if (state.status === "error") {
    return (
      <div className="flex flex-col items-start gap-4">
        <FormError>{t(state.error === "NOT_FOUND" ? "trip.notFound" : "trip.loadError")}</FormError>
        <Link href="/planner" className="text-label-lg text-accent hover:underline">
          {t("trip.back")}
        </Link>
      </div>
    );
  }

  const { trip, items, tasks } = state.data;

  return (
    <div className="flex flex-col gap-6">
      <TripHeader
        trip={trip}
        mutate={mutate}
        regenerating={regenerating}
        onRegenerate={regenerate}
        onDelete={handleDelete}
      />

      {error && (
        <div role="alert">
          <FormError>{t(`errors.${error}`)}</FormError>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DayPlanner trip={trip} items={items} mutate={mutate} />
        <aside className="flex flex-col gap-6">
          <TaskChecklist tasks={tasks} mutate={mutate} />
          <BudgetCard trip={trip} mutate={mutate} />
          <TripChat basePath={basePath} trip={trip} mutate={mutate} />
        </aside>
      </div>
    </div>
  );
}

// ─── En-tête : titre, dates, budget, actions ────────────────────────────────

function TripHeader({
  trip,
  mutate,
  regenerating,
  onRegenerate,
  onDelete,
}: {
  trip: Trip;
  mutate: Mutate;
  regenerating: boolean;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("Planner");
  const tArchetypes = useTranslations("Archetypes");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [editing, setEditing] = useState(false);
  const total = budgetTotal(trip);

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title") ?? "");
    if (await mutate("", "PATCH", { title })) setEditing(false);
  }

  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="flex min-w-0 flex-col gap-1">
          <nav aria-label={t("trip.breadcrumb")} className="font-display text-label-md text-ink-soft uppercase">
            <Link href="/planner" className="hover:text-accent">
              {t("trip.breadcrumb")}
            </Link>
            <span aria-hidden="true"> / </span>
            {flagEmoji(trip.destination_country_code)}{" "}
            {trip.destination_city ?? countryName(trip.destination_country_code, "fr")}
          </nav>

          {editing ? (
            <form onSubmit={handleRename} className="flex flex-wrap items-center gap-2">
              <label htmlFor="trip-title" className="sr-only">
                {t("trip.titleLabel")}
              </label>
              <Input id="trip-title" name="title" defaultValue={trip.title} maxLength={100} required autoFocus className="max-w-md" />
              <Button type="submit" size="sm">
                {t("trip.save")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
                {t("trip.cancel")}
              </Button>
            </form>
          ) : (
            <h1 className="flex items-center gap-2 font-display text-headline-lg text-ink">
              <span className="min-w-0">{trip.title}</span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t("trip.editTitle")}
                className="rounded-lg p-1 text-ink-soft transition hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
              >
                <Icon name="edit" className="size-4.5" />
              </button>
            </h1>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onDelete} disabled={regenerating} className="gap-1.5">
            <Icon name="delete" className="size-4" />
            {t("trip.delete")}
          </Button>
          <Button size="sm" onClick={onRegenerate} disabled={regenerating} className="gap-1.5">
            <Icon name="sparkles" className="size-4" />
            {regenerating ? t("trip.regenerating") : t("trip.regenerate")}
          </Button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-2">
        <Chip icon="calendar">
          {format.dateTimeRange(parseDay(trip.start_date), parseDay(trip.end_date), {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Chip>
        <Chip icon="category">{tArchetypes(trip.archetype)}</Chip>
        <Chip icon="book">
          {trip.budget_target === null
            ? t("trip.budgetChip", { total })
            : t("trip.budgetChipTarget", { total, target: trip.budget_target })}
        </Chip>
        {trip.generated_at && (
          <Chip icon="sparkles">
            {t("trip.aiSynced", { when: format.relativeTime(new Date(trip.generated_at), now) })}
          </Chip>
        )}
        <Chip icon="explore">{t("trip.sources", { count: trip.source_post_count })}</Chip>
      </ul>
    </Card>
  );
}

function Chip({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-1.5 text-body-sm text-ink-soft">
      <Icon name={icon} className="size-4" />
      {children}
    </li>
  );
}

// ─── Planning jour par jour ─────────────────────────────────────────────────

function DayPlanner({ trip, items, mutate }: { trip: Trip; items: TripItem[]; mutate: Mutate }) {
  const t = useTranslations("Planner");
  const format = useFormatter();
  const days = tripDays(trip.start_date, trip.end_date);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const [adding, setAdding] = useState(false);
  // Jour sélectionné encore valide (le voyage peut avoir été régénéré).
  const day = days.includes(selectedDay) ? selectedDay : days[0];
  const dayNumber = days.indexOf(day) + 1;
  const dayItems = items.filter((item) => item.day === day);

  return (
    <Card className="flex flex-col gap-5 p-6">
      <h2 className="font-display text-headline-sm text-ink">{t("days.title")}</h2>

      {/* Sélecteur de jour (onglets). */}
      <div role="tablist" aria-label={t("days.title")} className="flex gap-2 overflow-x-auto pb-1">
        {days.map((value, index) => {
          const active = value === day;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSelectedDay(value);
                setAdding(false);
              }}
              className={`flex shrink-0 flex-col items-center rounded-lg px-4 py-2 font-display text-label-md transition focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none ${
                active ? "bg-ink text-surface" : "bg-surface-muted text-ink-soft hover:text-ink"
              }`}
            >
              <span>{t("days.label", { number: index + 1 })}</span>
              <span className="text-label-sm opacity-80">
                {format.dateTime(parseDay(value), { day: "numeric", month: "short" })}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-label-lg text-ink">
            {t("days.heading", {
              number: dayNumber,
              date: format.dateTime(parseDay(day), { weekday: "long", day: "numeric", month: "long" }),
            })}
          </h3>
          <span className="rounded-lg bg-surface-muted px-2.5 py-1 text-label-sm text-ink-soft">
            {t("days.count", { count: dayItems.length })}
          </span>
        </div>

        {dayItems.length === 0 && <p className="text-body-sm text-ink-soft">{t("days.empty")}</p>}

        <ol className="flex flex-col gap-3">
          {dayItems.map((item) => (
            <ItemRow key={item.id} item={item} days={days} mutate={mutate} />
          ))}
        </ol>

        {adding ? (
          <ItemForm
            days={days}
            initial={{ day, start_time: "09:00", title: "", description: null, category: "activity" }}
            onCancel={() => setAdding(false)}
            onSubmit={async (body) => {
              if (await mutate("/items", "POST", body)) setAdding(false);
            }}
          />
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)} className="gap-1.5 self-start">
            <Icon name="add" className="size-4" />
            {t("item.add")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function ItemRow({ item, days, mutate }: { item: TripItem; days: string[]; mutate: Mutate }) {
  const t = useTranslations("Planner");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <ItemForm
          days={days}
          initial={item}
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            if (await mutate(`/items/${item.id}`, "PATCH", body)) setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex gap-4 rounded-lg bg-surface-muted p-4">
      <span className="w-12 shrink-0 font-display text-label-lg text-ink">{item.start_time}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 font-display text-label-lg text-ink">
          <Icon name={CATEGORY_ICONS[item.category]} className="size-4.5 text-ink-soft" />
          {item.title}
        </span>
        {item.description && <p className="text-body-sm text-ink-soft">{item.description}</p>}
        {item.source_post && (
          <p className="text-body-sm text-ink-soft">
            {t("item.source")}{" "}
            <Link href={`/post/${item.source_post.slug}`} className="font-medium text-accent hover:underline">
              {item.source_post.title}
            </Link>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <IconButton icon="edit" label={t("item.edit", { title: item.title })} onClick={() => setEditing(true)} />
        <IconButton
          icon="delete"
          label={t("item.delete", { title: item.title })}
          onClick={() => void mutate(`/items/${item.id}`, "DELETE")}
        />
      </div>
    </li>
  );
}

type ItemFormValues = Pick<TripItem, "day" | "start_time" | "title" | "description" | "category">;

// Formulaire d'activité (ajout et modification).
function ItemForm({
  days,
  initial,
  onSubmit,
  onCancel,
}: {
  days: string[];
  initial: ItemFormValues;
  onSubmit: (body: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("Planner");
  const format = useFormatter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    await onSubmit({
      day: String(form.get("day")),
      startTime: String(form.get("startTime")),
      title: String(form.get("title")),
      description: String(form.get("description") ?? ""),
      category: String(form.get("category")),
    });
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="item-day" label={t("days.title")}>
          <select id="item-day" name="day" defaultValue={initial.day} className={`h-11 ${FIELD_CLASS_NAME}`}>
            {days.map((value, index) => (
              <option key={value} value={value}>
                {t("days.dayTab", {
                  number: index + 1,
                  date: format.dateTime(parseDay(value), { day: "numeric", month: "short" }),
                })}
              </option>
            ))}
          </select>
        </Field>
        <Field id="item-time" label={t("item.time")}>
          <Input id="item-time" name="startTime" type="time" defaultValue={initial.start_time} required />
        </Field>
        <Field id="item-category" label={t("item.category")}>
          <select id="item-category" name="category" defaultValue={initial.category} className={`h-11 ${FIELD_CLASS_NAME}`}>
            {ITEM_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`categories.${category}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="item-title" label={t("item.title")}>
        <Input
          id="item-title"
          name="title"
          defaultValue={initial.title}
          maxLength={120}
          placeholder={t("item.titlePlaceholder")}
          required
        />
      </Field>
      <Field id="item-description" label={t("item.description")}>
        <Textarea
          id="item-description"
          name="description"
          defaultValue={initial.description ?? ""}
          maxLength={500}
          placeholder={t("item.descriptionPlaceholder")}
          className="min-h-20"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {t("item.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {t("item.save")}
        </Button>
      </div>
    </form>
  );
}

// ─── Checklist ──────────────────────────────────────────────────────────────

function TaskChecklist({ tasks, mutate }: { tasks: TripTask[]; mutate: Mutate }) {
  const t = useTranslations("Planner");
  const done = tasks.filter((task) => task.done).length;

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const label = String(new FormData(form).get("label") ?? "");
    if (await mutate("/tasks", "POST", { label })) form.reset();
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-headline-sm text-ink">{t("tasks.title")}</h2>
        <span className="rounded-lg bg-surface-muted px-2.5 py-1 text-label-sm text-ink-soft">
          {t("tasks.progress", { done, total: tasks.length })}
        </span>
      </div>

      {tasks.length === 0 && <p className="text-body-sm text-ink-soft">{t("tasks.empty")}</p>}

      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-start gap-2 rounded-lg bg-surface-muted px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Checkbox
                checked={task.done}
                onChange={(event) => void mutate(`/tasks/${task.id}`, "PATCH", { done: event.currentTarget.checked })}
                className="items-start"
              >
                <span className={task.done ? "text-ink-soft line-through" : "text-ink"}>{task.label}</span>
              </Checkbox>
              {task.detail && <span className="pl-6.5 text-label-sm text-ink-soft">{task.detail}</span>}
            </div>
            <IconButton
              icon="close"
              label={t("tasks.delete", { label: task.label })}
              onClick={() => void mutate(`/tasks/${task.id}`, "DELETE")}
            />
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <label htmlFor="task-label" className="sr-only">
          {t("tasks.addLabel")}
        </label>
        <Input id="task-label" name="label" maxLength={120} placeholder={t("tasks.addPlaceholder")} required />
        <Button type="submit" variant="secondary" className="shrink-0">
          {t("tasks.add")}
        </Button>
      </form>
    </Card>
  );
}

// ─── Budget ─────────────────────────────────────────────────────────────────

function BudgetCard({ trip, mutate }: { trip: Trip; mutate: Mutate }) {
  const t = useTranslations("Planner");
  const [saved, setSaved] = useState(false);
  const total = budgetTotal(trip);
  const target = trip.budget_target;
  const progress = target ? Math.min(100, Math.round((total / target) * 100)) : 100;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = (name: string) => Math.max(0, Math.round(Number(form.get(name) || 0)));
    const targetValue = String(form.get("budgetTarget") ?? "").trim();

    setSaved(false);
    const ok = await mutate("", "PATCH", {
      ...Object.fromEntries(BUDGET_FIELDS.map(({ body }) => [body, amount(body)])),
      budgetTarget: targetValue === "" ? null : amount("budgetTarget"),
    });
    setSaved(ok);
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-headline-sm text-ink">{t("budget.title")}</h2>
        <span className="font-display text-label-lg text-ink">
          {target === null ? t("budget.total", { total }) : t("budget.totalWithTarget", { total, target })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div
          className={`h-full rounded-full ${target !== null && total > target ? "bg-error" : "bg-ink"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* key : les champs repartent des valeurs à jour après une régénération. */}
      <form
        key={`${trip.generated_at}-${total}-${target}`}
        onSubmit={handleSubmit}
        onChange={() => setSaved(false)}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-3">
          {BUDGET_FIELDS.map(({ key, body, label }) => (
            <Field key={key} id={`budget-${label}`} label={t(`budget.${label}`)}>
              <Input id={`budget-${label}`} name={body} type="number" min={0} max={1_000_000} step={1} defaultValue={trip[key]} />
            </Field>
          ))}
        </div>
        <Field id="budget-target" label={t("budget.target")}>
          <Input
            id="budget-target"
            name="budgetTarget"
            type="number"
            min={0}
            max={1_000_000}
            step={1}
            defaultValue={target ?? ""}
            placeholder={t("budget.targetPlaceholder")}
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span role="status" className="text-body-sm text-ink-soft">
              {t("budget.saved")}
            </span>
          )}
          <Button type="submit" variant="secondary" size="sm">
            {t("budget.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Discussion avec l'IA ───────────────────────────────────────────────────

// Discussion limitée au voyage et à sa destination. L'IA propose des activités :
// chacune n'est ajoutée au planning que si l'utilisateur répond oui.
function TripChat({ basePath, trip, mutate }: { basePath: string; trip: Trip; mutate: Mutate }) {
  const t = useTranslations("Planner");
  const router = useRouter();
  const [messages, setMessages] = useState<TripMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<PlannerError | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const days = tripDays(trip.start_date, trip.end_date);
  const remaining = CHAT_MAX_USER_MESSAGES - (messages ?? []).filter((message) => message.role === "user").length;

  const loadMessages = useCallback(
    () =>
      apiFetch<{ messages: TripMessage[] }>(`${basePath}/messages`).then((result) => {
        if ("data" in result) return setMessages(result.data.messages);
        if (result.error === "UNAUTHORIZED") return router.replace("/login");
        setError(plannerError(result.error));
      }),
    [basePath, router],
  );

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Dernier message toujours visible.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const content = draft.trim();
    if (content.length < 2 || sending) return;

    setSending(true);
    setError(null);
    const result = await apiFetch<{ messages: TripMessage[] }>(`${basePath}/messages`, {
      method: "POST",
      body: { content },
    });
    setSending(false);

    if ("data" in result) {
      setMessages(result.data.messages);
      setDraft("");
      return;
    }
    if (result.error === "UNAUTHORIZED") return router.replace("/login");
    setError(plannerError(result.error));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  // Entrée envoie, Maj + Entrée passe à la ligne.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  async function answer(suggestion: TripSuggestion, accepted: boolean) {
    const ok = await mutate(`/suggestions/${suggestion.id}`, "PATCH", { accepted });
    if (!ok) return loadMessages();
    const status = accepted ? "accepted" : "rejected";
    setMessages((current) =>
      (current ?? []).map((message) => ({
        ...message,
        suggestions: message.suggestions.map((item) => (item.id === suggestion.id ? { ...item, status } : item)),
      })),
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-display text-headline-sm text-ink">
          <Icon name="sparkles" className="size-5 text-accent" />
          {t("chat.title")}
        </h2>
        <p className="text-body-sm text-ink-soft">{t("chat.hint")}</p>
      </div>

      <div ref={scroller} className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto" aria-live="polite">
        {messages === null && !error && <div className="h-16 animate-pulse rounded-lg bg-surface-muted" aria-hidden="true" />}
        {messages?.length === 0 && <p className="text-body-sm text-ink-soft">{t("chat.empty")}</p>}

        {messages?.map((message) =>
          message.role === "user" ? (
            <p
              key={message.id}
              className="max-w-[85%] self-end rounded-lg bg-ink px-3 py-2 text-body-sm whitespace-pre-line text-surface"
            >
              {message.content}
            </p>
          ) : (
            <div key={message.id} className="flex max-w-[95%] flex-col gap-2 self-start">
              <p
                className={`rounded-lg bg-surface-muted px-3 py-2 text-body-sm whitespace-pre-line ${
                  message.off_topic ? "text-ink-soft italic" : "text-ink"
                }`}
              >
                {message.off_topic ? t("chat.offTopic") : message.content}
              </p>
              {message.suggestions.length > 0 && (
                <ul className="flex flex-col gap-2" aria-label={t("chat.suggestions")}>
                  {message.suggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      dayNumber={days.indexOf(suggestion.day) + 1}
                      onAnswer={(accepted) => answer(suggestion, accepted)}
                    />
                  ))}
                </ul>
              )}
            </div>
          ),
        )}

        {sending && (
          <>
            <p className="max-w-[85%] self-end rounded-lg bg-ink px-3 py-2 text-body-sm whitespace-pre-line text-surface">
              {draft.trim()}
            </p>
            <p role="status" className="animate-pulse self-start rounded-lg bg-surface-muted px-3 py-2 text-body-sm text-ink-soft">
              {t("chat.pending")}
            </p>
          </>
        )}
      </div>

      {error && <FormError>{t(`errors.${error}`)}</FormError>}

      {remaining > 0 ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="chat-message" className="sr-only">
            {t("chat.label")}
          </label>
          <div className="flex items-end gap-2">
            <Textarea
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              minLength={2}
              maxLength={CHAT_MESSAGE_MAX}
              rows={1}
              placeholder={t("chat.placeholder")}
              required
              className="max-h-40"
            />
            <Button type="submit" disabled={sending || messages === null} aria-label={t("chat.send")} className="shrink-0 px-3">
              <Icon name="send" className="size-5" />
            </Button>
          </div>
          {remaining <= 10 && <p className="text-label-sm text-ink-soft">{t("chat.remaining", { count: remaining })}</p>}
        </form>
      ) : (
        <p className="text-body-sm text-ink-soft">{t("errors.CHAT_LIMIT_REACHED")}</p>
      )}
    </Card>
  );
}

function SuggestionCard({
  suggestion,
  dayNumber,
  onAnswer,
}: {
  suggestion: TripSuggestion;
  dayNumber: number;
  onAnswer: (accepted: boolean) => Promise<unknown>;
}) {
  const t = useTranslations("Planner");
  const format = useFormatter();
  const [pending, setPending] = useState(false);

  async function handleAnswer(accepted: boolean) {
    setPending(true);
    await onAnswer(accepted);
    setPending(false);
  }

  return (
    <li
      className={`flex flex-col gap-1.5 rounded-lg border border-line p-3 ${
        suggestion.status === "rejected" ? "opacity-60" : "bg-surface"
      }`}
    >
      <span className="flex items-center gap-1.5 text-label-sm text-ink-soft">
        <Icon name={CATEGORY_ICONS[suggestion.category]} className="size-4" />
        {t("chat.suggestionWhen", {
          number: dayNumber,
          date: format.dateTime(parseDay(suggestion.day), { day: "numeric", month: "short" }),
          time: suggestion.start_time,
        })}
      </span>
      <span className="font-display text-label-lg text-ink">{suggestion.title}</span>
      {suggestion.description && <p className="text-body-sm text-ink-soft">{suggestion.description}</p>}
      {suggestion.source_post && (
        <p className="text-body-sm text-ink-soft">
          {t("item.source")}{" "}
          <Link href={`/post/${suggestion.source_post.slug}`} className="font-medium text-accent hover:underline">
            {suggestion.source_post.title}
          </Link>
        </p>
      )}

      {suggestion.status === "pending" ? (
        <div className="mt-1 flex items-center gap-2">
          <span className="mr-auto text-label-sm text-ink-soft">{t("chat.question")}</span>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => void handleAnswer(false)}>
            {t("chat.no")}
          </Button>
          <Button size="sm" disabled={pending} onClick={() => void handleAnswer(true)}>
            <Icon name="check" className="size-4" />
            {t("chat.yes")}
          </Button>
        </div>
      ) : (
        <span
          className={`mt-1 flex items-center gap-1.5 text-label-sm ${
            suggestion.status === "accepted" ? "text-accent" : "text-ink-soft"
          }`}
        >
          {suggestion.status === "accepted" && <Icon name="check" className="size-4" />}
          {t(suggestion.status === "accepted" ? "chat.accepted" : "chat.rejected")}
        </span>
      )}
    </li>
  );
}

// ─── Communs ────────────────────────────────────────────────────────────────

function IconButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-lg p-1.5 text-ink-soft transition hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
    >
      <Icon name={icon} className="size-4" />
    </button>
  );
}

function PlannerSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Card className="h-40 animate-pulse bg-surface-muted" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="h-96 animate-pulse bg-surface-muted" />
        <Card className="h-96 animate-pulse bg-surface-muted" />
      </div>
    </div>
  );
}

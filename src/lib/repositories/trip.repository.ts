import "server-only";
import { getDb } from "@/utils/db";
import type { TripItemCategory } from "@/schemas/trip.schema";

export type TripSummary = {
  id: number;
  title: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  start_date: string;
  end_date: string;
  archetype: string;
  item_count: number;
  created_at: string;
};

export type TripRow = Omit<TripSummary, "item_count"> & {
  user_id: string;
  budget_lodging: number;
  budget_transit: number;
  budget_dining: number;
  budget_activities: number;
  budget_target: number | null;
  source_post_count: number;
  generated_at: string | null;
};

export type TripItemRow = {
  id: number;
  day: string;
  start_time: string;
  title: string;
  description: string | null;
  category: TripItemCategory;
  source_post: { id: number; title: string; slug: string } | null;
};

export type TripTaskRow = { id: number; label: string; detail: string | null; done: boolean };

export type NewTrip = {
  user_id: string;
  title: string;
  destination_country_code: string;
  destination_state_code: string | null;
  destination_city: string | null;
  start_date: string;
  end_date: string;
  archetype_id: number;
};

// Planning complet produit par l'IA (remplace le précédent d'un bloc).
export type TripPlan = {
  items: { day: string; start_time: string; title: string; description: string | null; category: TripItemCategory; source_post_id: number | null }[];
  tasks: { label: string; detail: string | null; done: boolean }[];
  budget: { lodging: number; transit: number; dining: number; activities: number };
  source_post_count: number;
};

export type TripChanges = Partial<{
  title: string;
  budget_target: number | null;
  budget_lodging: number;
  budget_transit: number;
  budget_dining: number;
  budget_activities: number;
}>;

export type TripItemFields = {
  day: string;
  start_time: string;
  title: string;
  description: string | null;
  category: TripItemCategory;
};

export type TripTaskChanges = Partial<{ label: string; done: boolean }>;

export type TripSuggestionStatus = "pending" | "accepted" | "rejected";

export type TripSuggestionRow = TripItemRow & { status: TripSuggestionStatus };

export type TripMessageRow = {
  id: number;
  role: "user" | "assistant";
  content: string;
  off_topic: boolean;
  created_at: string;
  suggestions: TripSuggestionRow[];
};

// Échange de la discussion : message de l'utilisateur + réponse de l'IA et ses propositions.
export type NewTripExchange = {
  user_content: string;
  assistant_content: string;
  off_topic: boolean;
  suggestions: (TripItemFields & { source_post_id: number | null })[];
};

// Colonnes modifiables : les noms viennent de cette liste, jamais de l'entrée utilisateur.
const TRIP_COLUMNS = ["title", "budget_target", "budget_lodging", "budget_transit", "budget_dining", "budget_activities"] as const;
const ITEM_COLUMNS = ["day", "start_time", "title", "description", "category"] as const;
const TASK_COLUMNS = ["label", "done"] as const;

const TRIP_SUMMARY_COLUMNS = `t.id, t.title, t.destination_country_code, t.destination_state_code, t.destination_city,
  t.start_date, t.end_date, a.slug as archetype, t.created_at`;

// « HH:MM » (le type time de Postgres renvoie « HH:MM:SS »).
const ITEM_COLUMNS_SELECT = `i.id, i.day, to_char(i.start_time, 'HH24:MI') as start_time, i.title, i.description, i.category,
  case when p.id is null then null else json_build_object('id', p.id, 'title', p.title, 'slug', p.slug) end as source_post`;

export async function insertTrip(trip: NewTrip): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `insert into trip (user_id, title, destination_country_code, destination_state_code, destination_city,
       start_date, end_date, archetype_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      trip.user_id,
      trip.title,
      trip.destination_country_code,
      trip.destination_state_code,
      trip.destination_city,
      trip.start_date,
      trip.end_date,
      trip.archetype_id,
    ],
  );
  return rows[0].id;
}

export async function findTripsByUser(userId: string): Promise<TripSummary[]> {
  const db = await getDb();
  const { rows } = await db.query<TripSummary>(
    `select ${TRIP_SUMMARY_COLUMNS}, (select count(*)::int from trip_item i where i.trip_id = t.id) as item_count
     from trip t join archetype a on a.id = t.archetype_id
     where t.user_id = $1
     order by t.start_date desc, t.id desc`,
    [userId],
  );
  return rows;
}

export async function findTripById(id: number): Promise<TripRow | null> {
  const db = await getDb();
  const { rows } = await db.query<TripRow>(
    `select ${TRIP_SUMMARY_COLUMNS}, t.user_id, t.budget_lodging, t.budget_transit, t.budget_dining,
       t.budget_activities, t.budget_target, t.source_post_count, t.generated_at
     from trip t join archetype a on a.id = t.archetype_id
     where t.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateTrip(id: number, changes: TripChanges) {
  const entries = TRIP_COLUMNS.filter((column) => changes[column] !== undefined).map((column) => [column, changes[column]] as const);
  if (entries.length === 0) return;

  const db = await getDb();
  await db.query(
    `update trip set ${entries.map(([column], index) => `${column} = $${index + 2}`).join(", ")} where id = $1`,
    [id, ...entries.map(([, value]) => value)],
  );
}

export async function deleteTrip(id: number) {
  const db = await getDb();
  await db.query("delete from trip where id = $1", [id]);
}

export async function findTripItems(tripId: number): Promise<TripItemRow[]> {
  const db = await getDb();
  const { rows } = await db.query<TripItemRow>(
    `select ${ITEM_COLUMNS_SELECT}
     from trip_item i left join post p on p.id = i.source_post_id
     where i.trip_id = $1
     order by i.day, i.start_time, i.id`,
    [tripId],
  );
  return rows;
}

export async function findTripTasks(tripId: number): Promise<TripTaskRow[]> {
  const db = await getDb();
  const { rows } = await db.query<TripTaskRow>(
    "select id, label, detail, done from trip_task where trip_id = $1 order by id",
    [tripId],
  );
  return rows;
}

// Remplace activités, tâches et budget en une transaction : jamais de planning à moitié enregistré.
export async function replaceTripPlan(tripId: number, plan: TripPlan) {
  const client = await (await getDb()).connect();
  try {
    await client.query("begin");
    await client.query("delete from trip_item where trip_id = $1", [tripId]);
    await client.query("delete from trip_task where trip_id = $1", [tripId]);

    if (plan.items.length > 0) {
      await client.query(
        `insert into trip_item (trip_id, day, start_time, title, description, category, source_post_id)
         select $1, * from unnest($2::date[], $3::time[], $4::varchar[], $5::varchar[], $6::trip_item_category[], $7::int[])`,
        [
          tripId,
          plan.items.map((item) => item.day),
          plan.items.map((item) => item.start_time),
          plan.items.map((item) => item.title),
          plan.items.map((item) => item.description),
          plan.items.map((item) => item.category),
          plan.items.map((item) => item.source_post_id),
        ],
      );
    }

    if (plan.tasks.length > 0) {
      await client.query(
        `insert into trip_task (trip_id, label, detail, done)
         select $1, * from unnest($2::varchar[], $3::varchar[], $4::boolean[])`,
        [tripId, plan.tasks.map((task) => task.label), plan.tasks.map((task) => task.detail), plan.tasks.map((task) => task.done)],
      );
    }

    await client.query(
      `update trip set budget_lodging = $2, budget_transit = $3, budget_dining = $4, budget_activities = $5,
         source_post_count = $6, generated_at = now()
       where id = $1`,
      [tripId, plan.budget.lodging, plan.budget.transit, plan.budget.dining, plan.budget.activities, plan.source_post_count],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function insertTripItem(tripId: number, item: TripItemFields): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    `insert into trip_item (trip_id, day, start_time, title, description, category)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [tripId, item.day, item.start_time, item.title, item.description, item.category],
  );
  return rows[0].id;
}

// Modifie une activité de ce voyage uniquement. false si elle n'existe pas (ou pas dans ce voyage).
export async function updateTripItem(tripId: number, itemId: number, changes: Partial<TripItemFields>): Promise<boolean> {
  const entries = ITEM_COLUMNS.filter((column) => changes[column] !== undefined).map((column) => [column, changes[column]] as const);
  if (entries.length === 0) return true;

  const db = await getDb();
  const { rowCount } = await db.query(
    `update trip_item set ${entries.map(([column], index) => `${column} = $${index + 3}`).join(", ")}
     where id = $1 and trip_id = $2`,
    [itemId, tripId, ...entries.map(([, value]) => value)],
  );
  return rowCount === 1;
}

export async function deleteTripItem(tripId: number, itemId: number): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("delete from trip_item where id = $1 and trip_id = $2", [itemId, tripId]);
  return rowCount === 1;
}

export async function insertTripTask(tripId: number, label: string): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ id: number }>(
    "insert into trip_task (trip_id, label) values ($1, $2) returning id",
    [tripId, label],
  );
  return rows[0].id;
}

export async function updateTripTask(tripId: number, taskId: number, changes: TripTaskChanges): Promise<boolean> {
  const entries = TASK_COLUMNS.filter((column) => changes[column] !== undefined).map((column) => [column, changes[column]] as const);
  if (entries.length === 0) return true;

  const db = await getDb();
  const { rowCount } = await db.query(
    `update trip_task set ${entries.map(([column], index) => `${column} = $${index + 3}`).join(", ")}
     where id = $1 and trip_id = $2`,
    [taskId, tripId, ...entries.map(([, value]) => value)],
  );
  return rowCount === 1;
}

export async function deleteTripTask(tripId: number, taskId: number): Promise<boolean> {
  const db = await getDb();
  const { rowCount } = await db.query("delete from trip_task where id = $1 and trip_id = $2", [taskId, tripId]);
  return rowCount === 1;
}

// ─── Discussion avec l'IA ───────────────────────────────────────────────────

// Messages du voyage dans l'ordre, chacun avec les propositions de l'IA qu'il contient.
export async function findTripMessages(tripId: number): Promise<TripMessageRow[]> {
  const db = await getDb();
  const { rows } = await db.query<TripMessageRow>(
    `select m.id, m.role, m.content, m.off_topic, m.created_at,
       coalesce(
         (select json_agg(json_build_object(
             'id', s.id, 'day', to_char(s.day, 'YYYY-MM-DD'), 'start_time', to_char(s.start_time, 'HH24:MI'),
             'title', s.title, 'description', s.description, 'category', s.category, 'status', s.status,
             'source_post', case when p.id is null then null else json_build_object('id', p.id, 'title', p.title, 'slug', p.slug) end
           ) order by s.day, s.start_time, s.id)
          from trip_suggestion s left join post p on p.id = s.source_post_id
          where s.message_id = m.id),
         '[]'
       ) as suggestions
     from trip_message m
     where m.trip_id = $1
     order by m.id`,
    [tripId],
  );
  return rows;
}

export async function countTripUserMessages(tripId: number): Promise<number> {
  const db = await getDb();
  const { rows } = await db.query<{ count: number }>(
    "select count(*)::int as count from trip_message where trip_id = $1 and role = 'user'",
    [tripId],
  );
  return rows[0].count;
}

// Enregistre l'échange en une transaction : jamais de question sans sa réponse.
export async function insertTripExchange(tripId: number, exchange: NewTripExchange) {
  const client = await (await getDb()).connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into trip_message (trip_id, role, content, off_topic) values ($1, 'user', $2, $3)`,
      [tripId, exchange.user_content, exchange.off_topic],
    );
    const { rows } = await client.query<{ id: number }>(
      `insert into trip_message (trip_id, role, content, off_topic) values ($1, 'assistant', $2, $3) returning id`,
      [tripId, exchange.assistant_content, exchange.off_topic],
    );

    const { suggestions } = exchange;
    if (suggestions.length > 0) {
      await client.query(
        `insert into trip_suggestion (trip_id, message_id, day, start_time, title, description, category, source_post_id)
         select $1, $2, * from unnest($3::date[], $4::time[], $5::varchar[], $6::varchar[], $7::trip_item_category[], $8::int[])`,
        [
          tripId,
          rows[0].id,
          suggestions.map((item) => item.day),
          suggestions.map((item) => item.start_time),
          suggestions.map((item) => item.title),
          suggestions.map((item) => item.description),
          suggestions.map((item) => item.category),
          suggestions.map((item) => item.source_post_id),
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// Répond à une proposition encore en attente de ce voyage ; acceptée, elle est copiée dans le planning.
// false si elle n'existe pas, appartient à un autre voyage ou a déjà reçu une réponse.
export async function answerTripSuggestion(tripId: number, suggestionId: number, accepted: boolean): Promise<boolean> {
  const client = await (await getDb()).connect();
  try {
    await client.query("begin");
    const { rowCount } = await client.query(
      `update trip_suggestion set status = $3 where id = $1 and trip_id = $2 and status = 'pending'`,
      [suggestionId, tripId, accepted ? "accepted" : "rejected"],
    );
    if (rowCount !== 1) {
      await client.query("rollback");
      return false;
    }

    if (accepted) {
      await client.query(
        `insert into trip_item (trip_id, day, start_time, title, description, category, source_post_id)
         select trip_id, day, start_time, title, description, category, source_post_id
         from trip_suggestion where id = $1`,
        [suggestionId],
      );
    }
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

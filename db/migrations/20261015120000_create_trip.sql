-- Planificateur de voyage (/planner) : voyages générés par l'IA à partir des posts, puis modifiables.
--   trip      → un voyage (destination, dates, type de récit, budget estimé)
--   trip_item → les activités du planning, jour par jour
--   trip_task → la checklist de préparation

set role brb_admin;

create table trip (
  id integer generated always as identity primary key,
  -- Propriétaire : seul lui peut consulter et modifier le voyage.
  user_id uuid not null references users (id) on delete cascade,
  title varchar(100) not null check (char_length(trim(title)) between 1 and 100),
  -- Destination choisie dans country-state-city (mêmes règles que post).
  destination_country_code char(2) not null check (destination_country_code ~ '^[A-Z]{2}$'),
  destination_state_code varchar(10) check (destination_state_code ~ '^[A-Za-z0-9-]{1,10}$'),
  destination_city varchar(100) check (char_length(destination_city) between 1 and 100),
  start_date date not null,
  end_date date not null,
  archetype_id integer not null references archetype (id),
  -- Budget en euros entiers : estimé par l'IA par catégorie, modifiable ; budget_target = enveloppe visée.
  budget_lodging integer not null default 0 check (budget_lodging between 0 and 1000000),
  budget_transit integer not null default 0 check (budget_transit between 0 and 1000000),
  budget_dining integer not null default 0 check (budget_dining between 0 and 1000000),
  budget_activities integer not null default 0 check (budget_activities between 0 and 1000000),
  budget_target integer check (budget_target between 0 and 1000000),
  -- Nombre de posts transmis à l'IA lors de la dernière génération (0 = planning générique).
  source_post_count integer not null default 0 check (source_post_count >= 0),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  -- 14 jours maximum : limite la taille de la génération (coût et temps de réponse).
  check (end_date - start_date < 14),
  check (destination_city is null or destination_state_code is not null)
);

create index trip_user_id_created_at_idx on trip (user_id, created_at desc);

create type trip_item_category as enum ('transport', 'lodging', 'activity', 'food');

create table trip_item (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  -- Jour de l'activité (compris entre les dates du voyage : vérifié par trip.service).
  day date not null,
  start_time time not null,
  title varchar(120) not null check (char_length(trim(title)) between 1 and 120),
  description varchar(500) check (char_length(description) <= 500),
  category trip_item_category not null default 'activity',
  -- Post dont l'activité s'inspire (null : suggestion générale de l'IA ou ajout manuel).
  source_post_id integer references post (id) on delete set null,
  created_at timestamptz not null default now()
);

create index trip_item_trip_id_day_idx on trip_item (trip_id, day, start_time);

create table trip_task (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  label varchar(120) not null check (char_length(trim(label)) between 1 and 120),
  detail varchar(200) check (char_length(detail) <= 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index trip_task_trip_id_idx on trip_task (trip_id);

-- Droits de l'application : l'utilisateur gère entièrement ses voyages (propriété vérifiée par trip.service).
grant select, insert, update, delete on trip, trip_item, trip_task to brb_app;

reset role;

-- Discussion avec l'IA sur un voyage (/planner/[id]) : remplace l'ajustement par consigne libre.
--   trip_message    → messages échangés (utilisateur et IA), limités au voyage et à sa destination
--   trip_suggestion → activités proposées par l'IA, ajoutées au planning seulement si l'utilisateur accepte

set role brb_admin;

create type trip_message_role as enum ('user', 'assistant');

create table trip_message (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  role trip_message_role not null,
  content varchar(1000) not null check (char_length(trim(content)) between 1 and 1000),
  -- Échange hors sujet (refusé par l'IA) : affiché, mais jamais renvoyé à l'IA dans l'historique.
  off_topic boolean not null default false,
  created_at timestamptz not null default now()
);

create index trip_message_trip_id_idx on trip_message (trip_id, id);

create type trip_suggestion_status as enum ('pending', 'accepted', 'rejected');

create table trip_suggestion (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  message_id integer not null references trip_message (id) on delete cascade,
  -- Mêmes champs que trip_item : copiés dans le planning si la proposition est acceptée.
  day date not null,
  start_time time not null,
  title varchar(120) not null check (char_length(trim(title)) between 1 and 120),
  description varchar(500) check (char_length(description) <= 500),
  category trip_item_category not null,
  source_post_id integer references post (id) on delete set null,
  status trip_suggestion_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index trip_suggestion_message_id_idx on trip_suggestion (message_id);
create index trip_suggestion_trip_id_idx on trip_suggestion (trip_id);

-- Droits de l'application : lecture, envoi des messages et réponse aux propositions (aucune suppression directe :
-- messages et propositions disparaissent avec le voyage).
grant select, insert on trip_message to brb_app;
grant select, insert, update on trip_suggestion to brb_app;

reset role;

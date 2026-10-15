-- Dépenses partagées d'un voyage, façon Tricount (/planner/[id], onglet Dépenses).
--   trip.currency       → devise du voyage : soldes et équilibrage y sont calculés
--   trip_participant    → qui partage les frais : un compte (propriétaire, membre) ou un invité sans compte (prénom)
--   trip_expense        → une dépense, dans sa devise ; taux de change figé à la saisie (BCE, à la date de la dépense)
--   trip_expense_share  → part de chaque participant, dans la devise du voyage (somme = montant converti, au centime)
--   trip_payment_task   → checklist « à payer » attribuée à un participant ; liée à la dépense une fois payée
-- Montants en unités mineures de leur devise (centimes ; 0 décimale pour JPY, KRW, ISK).

set role brb_admin;

alter table trip add column currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$');

create table trip_participant (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  -- Compte : nom lu dans users ; invité : prénom saisi. Compte supprimé : la ligne reste (historique des dépenses).
  user_id uuid references users (id) on delete set null,
  name varchar(60) check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id),
  check (user_id is not null or name is not null)
);

create index trip_participant_trip_id_idx on trip_participant (trip_id);

create type trip_expense_category as enum ('lodging', 'transport', 'food', 'activity', 'other');
create type trip_split_mode as enum ('equal', 'amounts', 'shares');

create table trip_expense (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  title varchar(120) not null check (char_length(trim(title)) between 1 and 120),
  amount_minor bigint not null check (amount_minor between 1 and 100000000000),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  -- Unités de la devise du voyage pour 1 unité de la devise de la dépense.
  rate numeric(20, 10) not null check (rate > 0),
  base_amount_minor bigint not null check (base_amount_minor >= 0),
  paid_by integer not null references trip_participant (id),
  spent_on date not null,
  category trip_expense_category not null,
  split_mode trip_split_mode not null,
  -- Remboursement entre participants (« marquer comme remboursé ») : exclu du total des dépenses.
  is_reimbursement boolean not null default false,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index trip_expense_trip_id_idx on trip_expense (trip_id, spent_on desc, id desc);

create table trip_expense_share (
  expense_id integer not null references trip_expense (id) on delete cascade,
  participant_id integer not null references trip_participant (id),
  -- Saisie : 1 (parts égales), montant dans la devise de la dépense, ou nombre de parts.
  weight numeric(16, 2) not null check (weight > 0),
  share_minor bigint not null check (share_minor >= 0),
  primary key (expense_id, participant_id)
);

create index trip_expense_share_participant_id_idx on trip_expense_share (participant_id);

create table trip_payment_task (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  label varchar(120) not null check (char_length(trim(label)) between 1 and 120),
  -- Estimation dans la devise du voyage.
  estimated_minor bigint check (estimated_minor between 1 and 100000000000),
  assignee_id integer references trip_participant (id) on delete set null,
  expense_id integer references trip_expense (id) on delete set null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index trip_payment_task_trip_id_idx on trip_payment_task (trip_id);

grant select, insert, update, delete on trip_participant, trip_expense, trip_expense_share, trip_payment_task to brb_app;

reset role;

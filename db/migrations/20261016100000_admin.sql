-- Administration (/admin) :
--   users.role / users.banned_at → rôles (badges) et bannissement
--   archetype                    → types de récit gérés depuis l'admin (libellé, description, actif)
--   post_report                  → signalements de posts par les utilisateurs (file de modération)
--   ai_usage / app_settings      → quota IA par utilisateur et par jour, plafond global réglable
--   admin_action                 → journal des actions des administrateurs

set role brb_admin;

-- ─── Rôles et bannissement ──────────────────────────────────────────────────
-- Seul « admin » donne des droits ; les autres rôles sont des badges affichés sur le profil et les récits.
create type user_role as enum ('traveler', 'globetrotter', 'dreamer', 'admin');

alter table users
  add column role user_role not null default 'traveler',
  -- Compte banni : connexion et renouvellement de session refusés, sessions révoquées.
  add column banned_at timestamptz;

-- ─── Types de récit ─────────────────────────────────────────────────────────
-- Les libellés quittent messages/fr.json pour la base : l'admin peut en créer sans toucher au code.
alter table archetype
  add column label varchar(40),
  add column description varchar(200),
  -- Inactif : plus proposé (feed, éditeur, planificateur), mais les récits existants le gardent.
  add column is_active boolean not null default true,
  add column created_at timestamptz not null default now();

update archetype set label = case slug
  when 'slow_travel_photography' then 'Slow travel & photo'
  when 'solo_architecture' then 'Architecture en solo'
  when 'culinary_heritage' then 'Patrimoine culinaire'
  when 'mountain_trek' then 'Trek en montagne'
  else slug
end;

alter table archetype
  alter column label set not null,
  add constraint archetype_label_check check (char_length(trim(label)) between 1 and 40),
  add constraint archetype_description_check check (char_length(description) <= 200);

create unique index archetype_label_key on archetype (lower(label));

-- ─── Signalements ───────────────────────────────────────────────────────────
create type post_report_status as enum ('open', 'dismissed', 'resolved');

create table post_report (
  id integer generated always as identity primary key,
  post_id integer not null references post (id) on delete cascade,
  reporter_id uuid not null references users (id) on delete cascade,
  reason varchar(500) check (char_length(reason) <= 500),
  status post_report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- Un utilisateur ne signale un même post qu'une fois.
  unique (post_id, reporter_id)
);

create index post_report_status_idx on post_report (status, created_at desc);

-- ─── Quota IA ───────────────────────────────────────────────────────────────
-- Appels à l'IA par utilisateur et par jour (heure de Paris) : génération, re-génération, discussion.
create table ai_usage (
  user_id uuid not null references users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

create index ai_usage_day_idx on ai_usage (day);

-- Réglages de l'app : une seule ligne (id toujours true).
create table app_settings (
  id boolean primary key default true check (id),
  ai_enabled boolean not null default true,
  -- Plafond d'appels IA par jour pour tout le site (protection de la facture).
  ai_daily_cap integer not null default 300 check (ai_daily_cap between 0 and 100000),
  updated_at timestamptz not null default now()
);

insert into app_settings default values;

-- ─── Journal des actions admin ──────────────────────────────────────────────
create table admin_action (
  id bigint generated always as identity primary key,
  -- Admin supprimé ensuite : l'action reste dans le journal, sans auteur.
  admin_id uuid references users (id) on delete set null,
  action varchar(40) not null,
  target_type varchar(20) not null,
  target_id varchar(64),
  details jsonb,
  created_at timestamptz not null default now()
);

create index admin_action_created_at_idx on admin_action (created_at desc);

-- ─── Droits de l'application ────────────────────────────────────────────────
grant update (role, banned_at) on users to brb_app;
grant delete on users to brb_app;
grant insert, update (label, description, is_active) on archetype to brb_app;
grant select, insert, update (status, resolved_at) on post_report to brb_app;
grant select, insert, update (count) on ai_usage to brb_app;
grant select, update (ai_enabled, ai_daily_cap, updated_at) on app_settings to brb_app;
grant select, insert on admin_action to brb_app;

reset role;

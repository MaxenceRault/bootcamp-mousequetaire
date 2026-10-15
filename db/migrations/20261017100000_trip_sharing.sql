-- Partage d'un voyage (/planner/[id]) : le propriétaire (trip.user_id) invite d'autres utilisateurs.
--   trip_member     → membres invités : editor (modifie tout sauf supprimer le voyage et gérer les membres)
--                     ou viewer (consulte, ajoute et gère ses propres dépenses)
--   trip_invitation → invitation par pseudo (en attente d'acceptation) ou par lien (réutilisable jusqu'à expiration).
--                     Lien : seule l'empreinte SHA-256 du code est stockée, comme pour les refresh tokens.
--   trip_message.author_id → auteur d'un message de la discussion IA, partagée entre les membres.

set role brb_admin;

create type trip_member_role as enum ('editor', 'viewer');

create table trip_member (
  trip_id integer not null references trip (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role trip_member_role not null,
  added_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_member_user_id_idx on trip_member (user_id);

create table trip_invitation (
  id integer generated always as identity primary key,
  trip_id integer not null references trip (id) on delete cascade,
  role trip_member_role not null,
  -- Par pseudo : l'invité ; par lien : null.
  invitee_id uuid references users (id) on delete cascade,
  token_hash char(64) unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references users (id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((invitee_id is null) <> (token_hash is null)),
  -- Une seule invitation en attente par personne et par voyage.
  unique (trip_id, invitee_id)
);

create index trip_invitation_invitee_id_idx on trip_invitation (invitee_id);

alter table trip_message add column author_id uuid references users (id) on delete set null;

grant select, insert, update, delete on trip_member, trip_invitation to brb_app;

reset role;

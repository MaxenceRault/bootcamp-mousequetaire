-- Tickets de support : un utilisateur connecté signale un problème ou pose une question,
-- les admins le suivent (ouvert → en cours → résolu) depuis l'administration.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette table.

set role brb_admin;

create type support_ticket_status as enum ('open', 'in_progress', 'resolved');

create table support_ticket (
  id integer generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  subject varchar(120) not null check (char_length(btrim(subject)) between 3 and 120),
  message varchar(2000) not null check (char_length(btrim(message)) between 10 and 2000),
  status support_ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- « Mes tickets » (plus récents d'abord) et liste de l'admin filtrée par état.
create index support_ticket_user_id_idx on support_ticket (user_id, created_at desc);
create index support_ticket_status_idx on support_ticket (status, created_at desc);

-- Droits de l'application : créer, lire, changer l'état (jamais modifier le texte ni supprimer).
grant select, insert, update (status, updated_at) on support_ticket to brb_app;

reset role;

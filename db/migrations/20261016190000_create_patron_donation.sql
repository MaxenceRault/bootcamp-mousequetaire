-- Rôle mécène payant via Buy Me a Coffee : le rôle est attribué uniquement quand Buy Me a Coffee confirme
-- le don (webhook signé), au compte Brb qui a la même adresse email. Aucune donnée bancaire n'est stockée.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui écrit dans cette table.

set role brb_admin;

-- Dons confirmés. Unique : Buy Me a Coffee réessaie un envoi en échec (webhook idempotent).
create table patron_donation (
  id integer generated always as identity primary key,
  bmc_payment_id bigint not null unique check (bmc_payment_id > 0),
  user_id uuid not null references users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  -- Rôle remplacé par « patron » (null si le compte l'était déjà) : rendu en cas de remboursement.
  previous_role user_role,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create index patron_donation_user_id_idx on patron_donation (user_id);

-- Droits de l'application : enregistrer un don, le relire, le marquer remboursé (jamais le supprimer).
grant select, insert on patron_donation to brb_app;
grant update (refunded_at) on patron_donation to brb_app;

reset role;

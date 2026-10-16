-- Pass voyage payant (Buy Me a Coffee, article « Extra ») : débloque les fonctions premium d'un voyage pour tous ses membres.
-- Attribué quand Buy Me a Coffee confirme l'achat (webhook signé), ou par un admin (achat à rattacher, pass offert).
-- Aucune donnée bancaire et aucun email en clair ne sont stockés.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit ces tables.

set role brb_admin;

create table trip_pass (
  id integer generated always as identity primary key,
  -- null : achat payé mais pas encore rattaché à un voyage (autre email, commande expirée) → attribution par un admin.
  trip_id integer references trip (id) on delete cascade,
  -- Compte Brb du payeur s'il est connu ; le pass reste au voyage si ce compte est supprimé.
  user_id uuid references users (id) on delete set null,
  -- null : pass offert par un admin. Unique : Buy Me a Coffee réessaie un envoi en échec (webhook idempotent).
  bmc_payment_id bigint unique check (bmc_payment_id > 0),
  amount numeric(10, 2) check (amount > 0),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  -- Email du paiement : empreinte HMAC (vérifie l'adresse déclarée par l'acheteur) et aperçu masqué (ex. « ki***@gmail.com »).
  payer_email_hash char(64) check (payer_email_hash ~ '^[0-9a-f]{64}$'),
  payer_email_hint varchar(80),
  -- Admin qui a rattaché l'achat ou offert le pass.
  granted_by uuid references users (id) on delete set null,
  assigned_at timestamptz,
  refunded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  -- Achat Buy Me a Coffee complet, ou pass offert (sans paiement) par un admin.
  check (
    (bmc_payment_id is not null and amount is not null and currency is not null)
    or (bmc_payment_id is null and amount is null and currency is null and granted_by is not null)
  ),
  check ((trip_id is null) = (assigned_at is null))
);

create index trip_pass_trip_id_idx on trip_pass (trip_id);
-- Achats à rattacher (onglet Pass voyage de l'administration).
create index trip_pass_unassigned_idx on trip_pass (created_at) where trip_id is null;

-- Achat en cours : le webhook ne connaît que l'email du payeur, cette ligne dit pour quel voyage il paie.
-- Une seule par compte (le dernier voyage choisi), valable 24 h.
create table trip_pass_order (
  user_id uuid primary key references users (id) on delete cascade,
  trip_id integer not null references trip (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Droits de l'application : enregistrer un pass, le relire, le rattacher, le retirer (jamais le supprimer).
grant select, insert on trip_pass to brb_app;
grant update (trip_id, granted_by, assigned_at, refunded_at, revoked_at) on trip_pass to brb_app;
grant select, insert, update, delete on trip_pass_order to brb_app;

reset role;

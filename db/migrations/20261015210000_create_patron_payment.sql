-- Rôle mécène payant : paiement unique via Stripe Checkout (carte, Apple Pay, Google Pay, PayPal…
-- selon le tableau de bord Stripe). Le rôle est attribué uniquement quand Stripe confirme le paiement
-- (webhook signé), jamais à partir du retour du navigateur. Aucune donnée bancaire n'est stockée.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui écrit dans ces tables (webhook Stripe).

set role brb_admin;

-- Le rôle lui-même est la valeur 'patron' de l'enum user_role (colonne users.role, migration des rôles) :
-- brb_app a déjà le droit de la modifier.

-- Trace des paiements confirmés. Unique : Stripe peut renvoyer le même événement (webhook idempotent).
create table patron_payment (
  id integer generated always as identity primary key,
  stripe_session_id text not null unique check (stripe_session_id ~ '^cs_[A-Za-z0-9_]{1,250}$'),
  user_id uuid not null references users (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null check (currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null default now()
);

create index patron_payment_user_id_idx on patron_payment (user_id);

-- Droits de l'application : enregistrer un paiement confirmé et le relire (jamais le modifier ni le supprimer).
grant select, insert on patron_payment to brb_app;

reset role;

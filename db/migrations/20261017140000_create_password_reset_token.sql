-- Mot de passe oublié : lien envoyé par email, à usage unique et de courte durée.
-- Seule l'empreinte SHA-256 du code est stockée : une fuite de la table ne permet pas de réinitialiser un compte.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui utilise cette table.

set role brb_admin;

create table password_reset_token (
  id integer generated always as identity primary key,
  user_id uuid not null references users (id) on delete cascade,
  token_hash char(64) not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index password_reset_token_user_id_idx on password_reset_token (user_id);

-- Droits de l'application : créer un lien, le relire, le marquer utilisé ; changer le mot de passe (haché bcrypt).
grant select, insert, update (used_at) on password_reset_token to brb_app;
grant update (password_hash) on users to brb_app;

reset role;

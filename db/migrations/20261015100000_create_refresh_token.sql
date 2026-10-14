-- Refresh tokens : prolongent la session sans redemander le mot de passe (access token JWT de 1 h).
-- Le token brut n'est jamais stocké : uniquement son empreinte SHA-256.
-- Rotation à chaque utilisation : l'ancien est révoqué, un nouveau est créé dans la même famille.
-- Un token déjà révoqué qui revient = vol probable → toute la famille est révoquée.

set role brb_admin;

create table refresh_token (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  -- Chaîne de rotation issue d'une même connexion (révoquée d'un bloc en cas de réutilisation).
  family_id uuid not null,
  token_hash char(64) not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Expiration absolue de la famille, recopiée à chaque rotation (pas de session infinie).
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index refresh_token_family_id_idx on refresh_token (family_id);
create index refresh_token_user_id_idx on refresh_token (user_id);

-- Droits de l'application : créer, lire et révoquer (jamais modifier le hash ni l'expiration).
grant select, insert on refresh_token to brb_app;
grant update (revoked_at) on refresh_token to brb_app;

reset role;

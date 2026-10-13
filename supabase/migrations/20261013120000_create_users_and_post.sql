-- Tables users + post pour le feed de la homepage.
-- À exécuter une fois dans Supabase : Dashboard → SQL Editor → coller ce fichier → Run.

-- Utilisateurs : uniquement les champs de profil public pour l'instant.
-- Les champs d'authentification (email, password_hash…) seront ajoutés avec la fonctionnalité de login.
-- (« user » est un mot réservé en Postgres, d'où « users ».)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now()
);

-- Catégories des onglets du feed.
create type public.post_category as enum ('culture', 'coast', 'food', 'ai_curated');

create table public.post (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 5000),
  location text not null check (char_length(location) between 1 and 120),
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  category public.post_category not null,
  tag text check (char_length(tag) <= 40),          -- badge affiché en haut à droite de la carte
  highlight text check (char_length(highlight) <= 120), -- ligne affichée à côté du bouton de la carte
  image_url text not null check (image_url ~ '^https://'),
  image_alt text not null check (char_length(image_alt) between 1 and 200),
  created_at timestamptz not null default now()
);

create index post_created_at_idx on public.post (created_at desc);
create index post_author_id_idx on public.post (author_id);
create index post_category_created_at_idx on public.post (category, created_at desc);

-- Sécurité : la clé publishable (rôles anon / authenticated) ne peut que LIRE.
-- Aucune policy d'écriture : insert / update / delete sont refusés par RLS.
alter table public.users enable row level security;
alter table public.post enable row level security;

create policy "Profils publics lisibles par tous"
  on public.users for select to anon, authenticated using (true);

create policy "Posts lisibles par tous"
  on public.post for select to anon, authenticated using (true);

-- Défense en profondeur : on retire les droits par défaut de Supabase et on ne rend que la lecture.
-- Sur users, la lecture est limitée aux colonnes publiques : une colonne ajoutée plus tard
-- (email, password_hash…) ne sera PAS lisible avec la clé publishable.
revoke all on public.users from anon, authenticated;
grant select (id, username, display_name, avatar_url, created_at) on public.users to anon, authenticated;

revoke all on public.post from anon, authenticated;
grant select on public.post to anon, authenticated;

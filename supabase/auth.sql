-- Ajout de l'authentification email + mot de passe sur public.users.
-- À exécuter une fois dans Supabase : Dashboard → SQL Editor → coller ce fichier → Run.
-- Ces colonnes ne sont pas lisibles avec la clé publishable (le grant select de users est limité aux colonnes publiques).
-- Seul le serveur Next (clé secrète SUPABASE_SECRET_KEY) les lit et les écrit.

alter table public.users
  add column email text unique check (email = lower(email) and char_length(email) <= 254),
  add column password_hash text check (password_hash like '$2%');

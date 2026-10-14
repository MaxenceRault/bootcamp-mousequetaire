-- Ville / base affichée sur la page profil (modifiable par l'utilisateur).
-- À exécuter une fois dans Supabase : Dashboard → SQL Editor → coller ce fichier → Run.

alter table public.users
  add column location text check (char_length(location) between 1 and 80);

-- Champ de profil public : lisible avec la clé publishable, comme les autres colonnes publiques.
grant select (location) on public.users to anon, authenticated;

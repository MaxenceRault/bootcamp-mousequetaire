-- Blobatar choisi par l'utilisateur : la chaîne à partir de laquelle son avatar est généré.
-- null = avatar par défaut (généré à partir de l'id).
-- À exécuter une fois dans Supabase : Dashboard → SQL Editor → coller ce fichier → Run.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette colonne (le login la sélectionne).

alter table public.users
  add column avatar_seed text check (avatar_seed ~ '^[A-Za-z0-9_-]{1,64}$');

-- Champ de profil public : lisible avec la clé publishable, comme les autres colonnes publiques.
grant select (avatar_seed) on public.users to anon, authenticated;

-- Personnalisation de l'avatar : photo de profil (avatar_url, colonne existante) ou image de fond
-- affichée derrière le blobatar (avatar_background_url). Les deux sont envoyées par l'utilisateur
-- depuis son profil et stockées dans le bucket Cloud Storage (dossiers avatars/ et avatar-backgrounds/).
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette colonne (connexion, feed, profil, page détail).

set role brb_admin;

alter table users
  add column avatar_background_url text check (char_length(avatar_background_url) <= 2048);

-- Droit minimal de l'application : modifier uniquement ces deux images (rien d'autre en plus).
grant update (avatar_url, avatar_background_url) on users to brb_app;

reset role;

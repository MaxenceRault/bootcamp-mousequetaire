-- Fond du blobatar : une couleur unie (choisie dans une palette) ou une image (avatar_background_url).
-- L'image, si elle existe, est affichée à la place de la couleur.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette colonne (connexion, feed, profil, page détail).

set role brb_admin;

alter table users
  add column avatar_background_color text check (avatar_background_color ~ '^#[0-9a-f]{6}$');

grant update (avatar_background_color) on users to brb_app;

reset role;

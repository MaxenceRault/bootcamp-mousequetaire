-- Image de fond du blobatar abandonnée : le fond est uniquement une couleur (avatar_background_color),
-- l'image passe par la photo de profil (avatar_url). Colonne ajoutée par 20261015170000, jamais utilisée en production.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- À exécuter APRÈS le déploiement du code qui ne lit plus cette colonne.

set role brb_admin;

-- Supprime aussi le droit update accordé à brb_app sur cette colonne.
alter table users drop column avatar_background_url;

reset role;

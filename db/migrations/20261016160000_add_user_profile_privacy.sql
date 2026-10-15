-- Confidentialité du profil public (/profile/{pseudo}) :
--   is_private : profil privé → les visiteurs ne voient que le nom, le pseudo et l'avatar ;
--   show_saved : afficher l'onglet « Enregistrés » aux visiteurs (désactivé par défaut).
-- Les récits d'un profil privé restent visibles dans le fil : seule la page profil est cachée.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.

set role brb_admin;

alter table users
  add column is_private boolean not null default false,
  add column show_saved boolean not null default false;

-- Droit minimal de l'application : l'utilisateur modifie ses propres réglages (PATCH /api/v1/users/me).
grant update (is_private, show_saved) on users to brb_app;

reset role;

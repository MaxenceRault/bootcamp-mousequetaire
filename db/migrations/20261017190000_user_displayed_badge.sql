-- Badge affiché par l'utilisateur, choisi parmi ceux qu'il a débloqués (voyageur, globe-trotteur, rêveur, mécène, admin).
-- Séparé de users.role : le rôle garde les droits (admin) et la logique du mécène (webhook) ; le badge n'est qu'un affichage.
-- null : badge du rôle (comportement d'avant).
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette colonne.

set role brb_admin;

alter table users add column displayed_badge user_role;

grant update (displayed_badge) on users to brb_app;

reset role;

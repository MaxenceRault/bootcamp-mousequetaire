-- 1) Discussion IA d'un voyage : l'IA peut proposer de modifier ou supprimer une activité, plus seulement d'en ajouter.
--    Chaque proposition reste en attente jusqu'au « oui » de l'utilisateur.
-- 2) Couleur d'une activité (vue Tableau et PDF), choisie dans une palette fixe (null : couleur de sa catégorie).
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit ces colonnes.

set role brb_admin;

create type trip_suggestion_action as enum ('add', 'update', 'delete');

alter table trip_suggestion
  add column action trip_suggestion_action not null default 'add',
  -- Activité modifiée ou supprimée (null pour un ajout, ou si l'activité a été supprimée entre-temps).
  add column target_item_id integer references trip_item (id) on delete set null;

-- Mêmes clés que TRIP_ITEM_COLORS (src/schemas/trip.schema.ts).
alter table trip_item
  add column color varchar(16) check (color in ('coral', 'sky', 'mint', 'sun', 'lavender', 'sand', 'rose', 'slate'));

reset role;

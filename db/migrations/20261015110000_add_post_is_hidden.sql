-- Posts masqués par leur auteur : retirés du feed, de la page détail et des pages de lieu,
-- toujours visibles par l'auteur dans son profil.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette colonne (feed, profil et page détail la filtrent).

set role brb_admin;

alter table post
  add column is_hidden boolean not null default false;

-- Le feed ne lit que les posts visibles, du plus récent au plus ancien (curseur sur l'id).
create index post_visible_id_idx on post (id desc) where not is_hidden;

-- Droit minimal de l'application : modifier uniquement la visibilité (rien d'autre dans post).
grant update (is_hidden) on post to brb_app;

reset role;

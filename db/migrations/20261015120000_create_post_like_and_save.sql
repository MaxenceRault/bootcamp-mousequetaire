-- Likes et enregistrements (« voyages enregistrés ») des posts.
-- Un utilisateur like / enregistre un post au plus une fois (clé primaire user_id + post_id).
-- Suppression en cascade : un post ou un compte supprimé emporte ses likes et enregistrements.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit ces tables (page détail, profil).

set role brb_admin;

create table post_like (
  user_id uuid not null references users (id) on delete cascade,
  post_id integer not null references post (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- Nombre de likes d'un post (la clé primaire couvre déjà « les likes d'un utilisateur »).
create index post_like_post_id_idx on post_like (post_id);

create table post_save (
  user_id uuid not null references users (id) on delete cascade,
  post_id integer not null references post (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- Liste des voyages enregistrés d'un utilisateur, du plus récent au plus ancien.
create index post_save_user_id_created_at_idx on post_save (user_id, created_at desc);

-- Droits de l'application : lire, ajouter et retirer (jamais modifier une ligne existante).
grant select, insert, delete on post_like, post_save to brb_app;

reset role;

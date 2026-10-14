-- Nouvelle table post (éditeur de récit /post/new) + tables de référence archetype et tag.
-- Reprise de la migration Supabase 20261014121000 (feat/post-editor), adaptée à Cloud SQL :
-- pas de RLS ni de rôles anon / authenticated, droits accordés au rôle brb_app.
-- Les photos sont dans le bucket Cloud Storage biirb-post-photos (créé avec gcloud, pas en SQL).
--
-- DESTRUCTIF : remplace les tables archetype, tag, post et post_tag de la migration init
-- (vides à part les 4 archétypes, réinsérés ci-dessous).

set role brb_admin;

drop table if exists post_tag, post, tag, archetype;

-- Types de récit (« Story Archetype » de la maquette), choisis dans une liste fermée.
-- Ils servent aussi d'onglets de filtre du feed (remplacent les anciennes catégories).
-- slug : identifiant stable en anglais ; le libellé affiché vient de messages/fr.json (i18n).
create table archetype (
  id integer generated always as identity primary key,
  slug varchar(40) not null unique check (slug ~ '^[a-z][a-z_]{0,39}$')
);

-- Tags = lieux de country-state-city : un pays, éventuellement une région et une ville.
-- Une ligne par lieu, partagée par tous les posts qui le citent.
create table tag (
  id integer generated always as identity primary key,
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  state_code varchar(10) check (state_code ~ '^[A-Za-z0-9-]{1,10}$'),
  city varchar(100) check (char_length(city) between 1 and 100),
  -- Une ville appartient toujours à une région (format de country-state-city).
  check (city is null or state_code is not null),
  -- nulls not distinct : « France » (sans région ni ville) n'existe qu'une seule fois.
  unique nulls not distinct (country_code, state_code, city)
);

create table post (
  id integer generated always as identity primary key,
  -- Auteur : nécessaire pour vérifier que seul le propriétaire modifie / supprime son post.
  author_id uuid not null references users (id) on delete cascade,
  title varchar(100) not null check (char_length(trim(title)) between 1 and 100),
  -- URL publique de la photo de couverture (bucket Cloud Storage biirb-post-photos).
  photo_url text not null check (char_length(photo_url) <= 2048),
  -- Texte alternatif de la photo (accessibilité, lecteurs d'écran).
  photo_alt varchar(200) not null check (char_length(trim(photo_alt)) between 1 and 200),
  short_description varchar(252) not null check (char_length(trim(short_description)) between 1 and 252),
  -- Limite haute pour éviter les textes géants (à ajuster si besoin).
  long_description text not null check (char_length(trim(long_description)) between 1 and 10000),
  -- Destination choisie dans country-state-city (mêmes règles que tag).
  destination_country_code char(2) not null check (destination_country_code ~ '^[A-Z]{2}$'),
  destination_state_code varchar(10) check (destination_state_code ~ '^[A-Za-z0-9-]{1,10}$'),
  destination_city varchar(100) check (char_length(destination_city) between 1 and 100),
  start_date date not null,
  end_date date not null,
  archetype_id integer not null references archetype (id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (destination_city is null or destination_state_code is not null)
);

-- Liaison plusieurs-à-plusieurs : un post a plusieurs tags, un tag sert à plusieurs posts.
create table post_tag (
  post_id integer not null references post (id) on delete cascade,
  tag_id integer not null references tag (id) on delete cascade,
  primary key (post_id, tag_id)
);

create index post_created_at_idx on post (created_at desc);
create index post_author_id_idx on post (author_id);
create index post_archetype_id_idx on post (archetype_id);
-- La clé primaire (post_id, tag_id) couvre « tags d'un post » ; cet index couvre « posts d'un tag ».
create index post_tag_tag_id_idx on post_tag (tag_id);

-- Données de référence : les types de récit proposés dans l'éditeur.
insert into archetype (slug) values
  ('slow_travel_photography'),
  ('solo_architecture'),
  ('culinary_heritage'),
  ('mountain_trek');

-- Droits de l'application : lecture + ce qu'utilise la création d'un post (post.repository).
grant select on archetype, tag, post, post_tag to brb_app;
grant insert, delete on post to brb_app;
grant insert on tag, post_tag to brb_app;
-- Nécessaire à « on conflict … do update » dans upsertTags.
grant update (country_code) on tag to brb_app;

reset role;

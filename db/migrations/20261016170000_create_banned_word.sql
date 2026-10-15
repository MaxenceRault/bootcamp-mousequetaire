-- Mots bannis de la modération du texte (récits, commentaires), gérés depuis l'admin.
-- term : forme normalisée (minuscules, sans accents). kind : word (mot exact), prefix (début de mot), phrase (expression).

set role brb_admin;

create table banned_word (
  id integer generated always as identity primary key,
  term varchar(60) not null unique check (term ~ '^[a-z]+( [a-z]+)*$'),
  reason varchar(20) not null check (reason in ('insult', 'hate', 'sexual', 'politics')),
  kind varchar(10) not null default 'word' check (kind in ('word', 'prefix', 'phrase')),
  created_at timestamptz not null default now()
);

grant select, insert, delete on banned_word to brb_app;

reset role;

-- Commentaires des récits (questions aux voyageurs). Lecture publique, écriture réservée aux connectés.

set role brb_admin;

create table post_comment (
  id integer generated always as identity primary key,
  post_id integer not null references post (id) on delete cascade,
  author_id uuid not null references users (id) on delete cascade,
  content varchar(1000) not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index post_comment_post_id_idx on post_comment (post_id, id);

grant select, insert, delete on post_comment to brb_app;

reset role;

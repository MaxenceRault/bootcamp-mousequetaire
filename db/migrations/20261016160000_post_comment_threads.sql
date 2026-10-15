-- Fils de commentaires : une réponse vise un commentaire de premier niveau (un seul niveau, vérifié par le service).
-- Supprimer un commentaire supprime ses réponses.

set role brb_admin;

alter table post_comment add column parent_id integer references post_comment (id) on delete cascade;

create index post_comment_parent_id_idx on post_comment (parent_id);

reset role;

-- Récit en attente de modération (IA indisponible à la publication) : masqué, et seul un admin peut le publier.
-- Distinct de is_hidden seul (masqué par son auteur, qu'il peut réafficher).

set role brb_admin;

alter table post add column pending_review boolean not null default false;

grant update (pending_review) on post to brb_app;

reset role;

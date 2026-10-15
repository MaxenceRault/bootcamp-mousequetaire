-- Récit mis en page (gras, italique, souligné, taille, listes, photos) : document JSON validé par l'API.
-- long_description reste le texte brut tiré de body (recherche, IA, temps de lecture). body null : ancien récit en texte brut.
-- body_photo_urls : photos insérées dans le texte, supprimées du bucket avec le récit.

set role brb_admin;

alter table post
  add column body jsonb check (body is null or jsonb_typeof(body) = 'object'),
  add column body_photo_urls text[] not null default '{}' check (cardinality(body_photo_urls) <= 5);

reset role;

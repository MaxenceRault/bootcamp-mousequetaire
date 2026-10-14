-- Slug des posts : identifiant lisible dans l'URL (/post/okinawa-et-ile-zamami) à la place de l'id.
-- Unique ; jamais vide ni uniquement des chiffres (pour ne pas être confondu avec un ancien lien /post/30).
-- Généré PAR LA BASE (trigger) à la création d'un post : une seule définition des règles, et le code déjà
-- déployé (qui n'envoie pas de slug) continue de fonctionner quel que soit l'ordre migration / déploiement.
-- Un slug ne change jamais ensuite (aucun droit update) : les liens partagés restent valides.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.

set role brb_admin;

-- Titre → minuscules, accents retirés (translate : l'extension unaccent n'est pas installée),
-- tout ce qui n'est pas lettre ou chiffre → « - », 100 caractères max ; « recit » si vide,
-- préfixe « recit- » si uniquement des chiffres.
create function post_slug_base(title text) returns text
language sql immutable
as $$
  select case
           when s = '' then 'recit'
           when s ~ '^[0-9]+$' then 'recit-' || s
           else s
         end
    from (
      select trim(both '-' from left(
               trim(both '-' from regexp_replace(
                 translate(replace(replace(replace(lower(title), 'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'),
                   'àáâãäåāăąçćĉčċďđèéêëēĕėęěĝğġģĥħìíîïĩīĭįıĵķĺļľŀłñńņňŉòóôõöøōŏőŕŗřśŝşšșţťŧțùúûüũūŭůűųŵýÿŷźżž',
                   'aaaaaaaaacccccddeeeeeeeeegggghhiiiiiiiiijklllllnnnnnooooooooorrrsssssttttuuuuuuuuuuwyyyzzz'),
                 '[^a-z0-9]+', '-', 'g')),
               100)) as s
    ) as cleaned
$$;

alter table post add column slug varchar(120);

-- Récits existants : slug de base, puis « -2 », « -3 »… pour les titres identiques (par ordre de création).
with numbered as (
  select id, post_slug_base(title) as base,
         row_number() over (partition by post_slug_base(title) order by id) as n
    from post
)
update post p
   set slug = case when numbered.n = 1 then numbered.base else numbered.base || '-' || numbered.n end
  from numbered
 where numbered.id = p.id;

alter table post alter column slug set not null;
alter table post add constraint post_slug_key unique (slug);
alter table post add constraint post_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug !~ '^[0-9]+$' and char_length(slug) <= 120);

-- Nouveau post sans slug : premier slug libre (« base », sinon « base-2 », « base-3 »…).
-- Deux créations simultanées du même titre : la seconde viole post_slug_key (l'app réessaie).
create function post_fill_slug() returns trigger
language plpgsql
as $$
declare
  base text := post_slug_base(new.title);
  candidate text := base;
  n integer := 1;
begin
  if new.slug is null then
    while exists (select 1 from post where slug = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end;
$$;

create trigger post_fill_slug before insert on post
  for each row execute function post_fill_slug();

-- brb_app a déjà « insert » et « select » sur toute la table post ; les fonctions sont exécutables par tous
-- (droit par défaut de Postgres) ; aucun « update » de slug.

reset role;

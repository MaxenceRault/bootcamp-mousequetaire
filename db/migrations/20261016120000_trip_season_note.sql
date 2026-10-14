-- Planificateur : note de saison rédigée par l'IA selon les dates du voyage
-- (météo moyenne, risques saisonniers, affluence et niveau de prix par rapport au reste de l'année).

set role brb_admin;

alter table trip
  add column season_note varchar(500) check (char_length(season_note) <= 500);

-- brb_app a déjà update sur trip (replaceTripPlan l'écrit à chaque génération).

reset role;

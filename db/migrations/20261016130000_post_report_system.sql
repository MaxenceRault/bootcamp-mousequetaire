-- Modération automatique : un signalement peut venir du système (reporter_id null),
-- ex. post publié masqué parce que l'IA de modération était indisponible.

set role brb_admin;

alter table post_report alter column reporter_id drop not null;

reset role;

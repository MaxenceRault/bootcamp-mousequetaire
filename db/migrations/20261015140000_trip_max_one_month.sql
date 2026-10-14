-- Durée maximale d'un voyage : 14 jours → 1 mois (31 jours, début et fin inclus).

set role brb_admin;

alter table trip drop constraint trip_check1;
alter table trip add constraint trip_max_length_check check (end_date - start_date < 31);

reset role;

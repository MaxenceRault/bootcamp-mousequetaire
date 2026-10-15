-- Participant d'un compte : son nom est copié, pour garder l'historique des dépenses si le compte est supprimé
-- (user_id passe à null : sans nom, la contrainte « compte ou nom » bloquait la suppression du compte).

set role brb_admin;

update trip_participant p set name = left(u.display_name, 60) from users u where u.id = p.user_id and p.name is null;

reset role;

-- Supprimer un voyage (ou le compte de son propriétaire) supprime participants et dépenses ensemble : les liens
-- participant → dépense suivent en cascade. Un invité présent dans une dépense est protégé par trip-expense.service.
set role brb_admin;

alter table trip_expense drop constraint trip_expense_paid_by_fkey,
  add constraint trip_expense_paid_by_fkey foreign key (paid_by) references trip_participant (id) on delete cascade;
alter table trip_expense_share drop constraint trip_expense_share_participant_id_fkey,
  add constraint trip_expense_share_participant_id_fkey foreign key (participant_id) references trip_participant (id) on delete cascade;

reset role;

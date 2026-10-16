-- Catégorie d'un ticket de support (tri dans l'administration). Pass voyage (paiement, activation) : les admins sont prévenus par email.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui écrit cette colonne. Les tickets existants deviennent « other ».

set role brb_admin;

-- Mêmes valeurs que TICKET_CATEGORIES (src/schemas/ticket.schema.ts).
create type support_ticket_category as enum ('trip_pass', 'bug', 'report', 'account', 'other');

alter table support_ticket add column category support_ticket_category not null default 'other';

reset role;

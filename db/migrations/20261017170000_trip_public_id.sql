-- Identifiant public d'un voyage (UUID) : seul identifiant visible dans les URL, l'API, la page du voyage et l'admin.
-- La clé primaire entière reste interne (clés étrangères) et ne sort plus du serveur : ids non devinables.
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui lit cette colonne. Les voyages existants reçoivent un UUID.

set role brb_admin;

alter table trip add column public_id uuid not null unique default gen_random_uuid();

reset role;

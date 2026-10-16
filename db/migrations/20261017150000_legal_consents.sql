-- Preuve des consentements : CGU acceptées à l'inscription, CGV et renonciation au droit de rétractation avant l'achat
-- d'un pass voyage (contenu numérique fourni immédiatement). Version = date de publication du texte (src/lib/legal.ts).
-- À exécuter dans Cloud SQL Studio (Console GCP → SQL → biirb-db1), connecté avec son compte Google.
-- ⚠️ À exécuter AVANT de déployer le code qui écrit ces colonnes.

set role brb_admin;

-- null : compte créé avant les CGU.
alter table users
  add column terms_accepted_at timestamptz,
  add column terms_version varchar(20);

-- Commande en cours : consentements donnés avant le lien de paiement (table vide jusqu'ici : jamais déployée).
alter table trip_pass_order
  add column sales_terms_version varchar(20) not null,
  add column withdrawal_waived_at timestamptz not null;

-- Copiés de la commande à l'achat. null : pass offert par un admin, ou achat sans commande (rattaché par un admin).
alter table trip_pass
  add column sales_terms_version varchar(20),
  add column withdrawal_waived_at timestamptz;

reset role;

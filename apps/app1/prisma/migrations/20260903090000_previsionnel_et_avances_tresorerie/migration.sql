-- Prévisionnel et avances sur les entrées de trésorerie.
--
-- Deux manques signalés par les organisateurs.
--
-- 1. Une ligne saisie à la main était réputée RÉGLÉE, faute de pouvoir dire le contraire. Une
--    dépense seulement prévue gonflait donc le réglé au même titre qu'une facture payée.
--    `isForecast` bascule le montant vers l'engagé : le solde ne change pas — il compte déjà
--    l'engagé — mais le réglé cesse de compter ce qui n'a pas été payé.
--
-- 2. Une dépense avancée de sa poche par un bénévole ou un organisateur est réglée du point de
--    vue du fournisseur, mais l'association DOIT ce montant à la personne. C'est une dette
--    distincte, qu'aucun champ ne portait. `advancedById` la nomme, `reimbursed` la solde.
--
-- Les trois colonnes ont un défaut qui reproduit le comportement actuel : les lignes existantes
-- restent réglées, sans avance, non remboursées.

ALTER TABLE `TreasuryEntry`
  ADD COLUMN `isForecast` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `advancedById` INTEGER NULL,
  ADD COLUMN `reimbursed` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `TreasuryEntry_advancedById_idx` ON `TreasuryEntry`(`advancedById`);

-- `SET NULL` et non `CASCADE` : la suppression d'un compte ne doit pas emporter une ligne
-- comptable. L'avance devient anonyme, la dépense reste dans les comptes.
ALTER TABLE `TreasuryEntry`
  ADD CONSTRAINT `TreasuryEntry_advancedById_fkey`
  FOREIGN KEY (`advancedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

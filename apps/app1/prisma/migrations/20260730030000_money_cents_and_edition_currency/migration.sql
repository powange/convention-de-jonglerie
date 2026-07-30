-- Devise de l'édition (ISO 4217). Vaut pour tous ses montants.
ALTER TABLE `Edition` ADD COLUMN `currency` VARCHAR(3) NOT NULL DEFAULT 'EUR';

-- Montants des artistes : Decimal(10,2) en unité courante -> entier de centimes.
--
-- Écrit à la main plutôt que généré : un `MODIFY ... INT` convertirait 125.00 en 125 centimes,
-- soit un montant divisé par cent, sans la moindre erreur pour le signaler. On ajoute donc une
-- colonne, on convertit, puis on remplace.
--
-- `ROUND` et non `TRUNCATE` : 150.55 * 100 vaut 15054.999... en flottant, et une troncature
-- perdrait un centime par ligne.

ALTER TABLE `EditionArtist` ADD COLUMN `payment_cents` INT NULL;
UPDATE `EditionArtist` SET `payment_cents` = ROUND(`payment` * 100) WHERE `payment` IS NOT NULL;
ALTER TABLE `EditionArtist` DROP COLUMN `payment`;
ALTER TABLE `EditionArtist` CHANGE `payment_cents` `payment` INT NULL;

ALTER TABLE `EditionArtist` ADD COLUMN `reimbursementMax_cents` INT NULL;
UPDATE `EditionArtist` SET `reimbursementMax_cents` = ROUND(`reimbursementMax` * 100) WHERE `reimbursementMax` IS NOT NULL;
ALTER TABLE `EditionArtist` DROP COLUMN `reimbursementMax`;
ALTER TABLE `EditionArtist` CHANGE `reimbursementMax_cents` `reimbursementMax` INT NULL;

ALTER TABLE `EditionArtist` ADD COLUMN `reimbursementActual_cents` INT NULL;
UPDATE `EditionArtist` SET `reimbursementActual_cents` = ROUND(`reimbursementActual` * 100) WHERE `reimbursementActual` IS NOT NULL;
ALTER TABLE `EditionArtist` DROP COLUMN `reimbursementActual`;
ALTER TABLE `EditionArtist` CHANGE `reimbursementActual_cents` `reimbursementActual` INT NULL;

ALTER TABLE `EditionArtist` ADD COLUMN `consumablesMax_cents` INT NULL;
UPDATE `EditionArtist` SET `consumablesMax_cents` = ROUND(`consumablesMax` * 100) WHERE `consumablesMax` IS NOT NULL;
ALTER TABLE `EditionArtist` DROP COLUMN `consumablesMax`;
ALTER TABLE `EditionArtist` CHANGE `consumablesMax_cents` `consumablesMax` INT NULL;

ALTER TABLE `EditionArtist` ADD COLUMN `consumablesActual_cents` INT NULL;
UPDATE `EditionArtist` SET `consumablesActual_cents` = ROUND(`consumablesActual` * 100) WHERE `consumablesActual` IS NOT NULL;
ALTER TABLE `EditionArtist` DROP COLUMN `consumablesActual`;
ALTER TABLE `EditionArtist` CHANGE `consumablesActual_cents` `consumablesActual` INT NULL;

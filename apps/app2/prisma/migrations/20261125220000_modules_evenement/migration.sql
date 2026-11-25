-- Activation des modules d'un événement. Non destructive : le module bénévoles reste actif partout.
ALTER TABLE `Event` ADD COLUMN `volunteersEnabled` BOOLEAN NOT NULL DEFAULT true;

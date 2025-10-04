-- AlterTable HelloAssoOrder - Ajouter un lien direct vers Edition

-- Étape 1: Ajouter editionId comme nullable d'abord
ALTER TABLE `HelloAssoOrder` ADD COLUMN `editionId` INTEGER NULL;

-- Étape 2: Remplir editionId pour les commandes existantes (depuis ExternalTicketing)
UPDATE `HelloAssoOrder`
SET `editionId` = (
    SELECT `editionId`
    FROM `ExternalTicketing`
    WHERE `ExternalTicketing`.`id` = `HelloAssoOrder`.`externalTicketingId`
);

-- Étape 3: Rendre editionId obligatoire maintenant qu'il est rempli
ALTER TABLE `HelloAssoOrder` MODIFY COLUMN `editionId` INTEGER NOT NULL;

-- Étape 4: Créer l'index et la clé étrangère pour editionId
CREATE INDEX `HelloAssoOrder_editionId_idx` ON `HelloAssoOrder`(`editionId`);

ALTER TABLE `HelloAssoOrder` ADD CONSTRAINT `HelloAssoOrder_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable HelloAssoOption - Permettre les options manuelles (non HelloAsso)

-- Étape 1: Ajouter editionId comme nullable d'abord
ALTER TABLE `HelloAssoOption` ADD COLUMN `editionId` INTEGER NULL;

-- Étape 2: Remplir editionId pour les options existantes (depuis ExternalTicketing)
UPDATE `HelloAssoOption`
SET `editionId` = (
    SELECT `editionId`
    FROM `ExternalTicketing`
    WHERE `ExternalTicketing`.`id` = `HelloAssoOption`.`externalTicketingId`
);

-- Étape 3: Rendre editionId obligatoire maintenant qu'il est rempli
ALTER TABLE `HelloAssoOption` MODIFY COLUMN `editionId` INTEGER NOT NULL;

-- Étape 4: Rendre externalTicketingId et helloAssoOptionId optionnels
ALTER TABLE `HelloAssoOption` MODIFY COLUMN `externalTicketingId` VARCHAR(191) NULL;
ALTER TABLE `HelloAssoOption` MODIFY COLUMN `helloAssoOptionId` VARCHAR(191) NULL;

-- Étape 5: Créer l'index et la clé étrangère pour editionId
CREATE INDEX `HelloAssoOption_editionId_idx` ON `HelloAssoOption`(`editionId`);

ALTER TABLE `HelloAssoOption` ADD CONSTRAINT `HelloAssoOption_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Étape 6: Modifier la relation avec ExternalTicketing pour être optionnelle
ALTER TABLE `HelloAssoOption` DROP FOREIGN KEY `HelloAssoOption_externalTicketingId_fkey`;
ALTER TABLE `HelloAssoOption` ADD CONSTRAINT `HelloAssoOption_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable HelloAssoTier - Permettre les tarifs manuels (non HelloAsso)

-- Étape 1: Ajouter editionId comme nullable d'abord
ALTER TABLE `HelloAssoTier` ADD COLUMN `editionId` INTEGER NULL;

-- Étape 2: Remplir editionId pour les tarifs existants (depuis ExternalTicketing)
UPDATE `HelloAssoTier`
SET `editionId` = (
    SELECT `editionId`
    FROM `ExternalTicketing`
    WHERE `ExternalTicketing`.`id` = `HelloAssoTier`.`externalTicketingId`
);

-- Étape 3: Rendre editionId obligatoire maintenant qu'il est rempli
ALTER TABLE `HelloAssoTier` MODIFY COLUMN `editionId` INTEGER NOT NULL;

-- Étape 4: Rendre externalTicketingId et helloAssoTierId optionnels
ALTER TABLE `HelloAssoTier` MODIFY COLUMN `externalTicketingId` VARCHAR(191) NULL;
ALTER TABLE `HelloAssoTier` MODIFY COLUMN `helloAssoTierId` INTEGER NULL;

-- Étape 5: Créer l'index et la clé étrangère pour editionId
CREATE INDEX `HelloAssoTier_editionId_idx` ON `HelloAssoTier`(`editionId`);

ALTER TABLE `HelloAssoTier` ADD CONSTRAINT `HelloAssoTier_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Étape 6: Modifier la relation avec ExternalTicketing pour être optionnelle
ALTER TABLE `HelloAssoTier` DROP FOREIGN KEY `HelloAssoTier_externalTicketingId_fkey`;
ALTER TABLE `HelloAssoTier` ADD CONSTRAINT `HelloAssoTier_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

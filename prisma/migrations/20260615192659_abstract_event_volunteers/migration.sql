-- Abstraction Event (étape 0, scope réduit) — migration RÉÉCRITE pour préserver les données.
-- Principe : un Event par Edition en réutilisant l'id (Event.id = Edition.id), puis renommage
-- des colonnes editionId -> eventId sur les 5 tables bénévoles (valeurs inchangées).

-- 1. Table Event
CREATE TABLE `Event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Backfill : un Event par Edition, id réutilisé.
--    (MySQL 8 / InnoDB recale automatiquement l'AUTO_INCREMENT sur MAX(id)+1 après ces insertions.)
INSERT INTO `Event` (`id`, `createdAt`, `updatedAt`)
SELECT `id`, `createdAt`, `updatedAt` FROM `Edition`;

-- 3. Edition.eventId : ajout nullable, backfill (= id), puis NOT NULL.
ALTER TABLE `Edition` ADD COLUMN `eventId` INTEGER NULL;
UPDATE `Edition` SET `eventId` = `id`;
ALTER TABLE `Edition` MODIFY COLUMN `eventId` INTEGER NOT NULL;

-- 4. Suppression des FK et index editionId sur les 5 tables bénévoles (avant renommage).
ALTER TABLE `EditionVolunteerApplication` DROP FOREIGN KEY `EditionVolunteerApplication_editionId_fkey`;
ALTER TABLE `VolunteerComment` DROP FOREIGN KEY `VolunteerComment_editionId_fkey`;
ALTER TABLE `VolunteerComment` DROP FOREIGN KEY `VolunteerComment_userId_fkey`;
ALTER TABLE `VolunteerNotificationGroup` DROP FOREIGN KEY `VolunteerNotificationGroup_editionId_fkey`;
ALTER TABLE `VolunteerTeam` DROP FOREIGN KEY `VolunteerTeam_editionId_fkey`;
ALTER TABLE `VolunteerTimeSlot` DROP FOREIGN KEY `VolunteerTimeSlot_editionId_fkey`;

DROP INDEX `EditionVolunteerApplication_editionId_idx` ON `EditionVolunteerApplication`;
DROP INDEX `EditionVolunteerApplication_editionId_userId_key` ON `EditionVolunteerApplication`;
DROP INDEX `VolunteerComment_editionId_idx` ON `VolunteerComment`;
DROP INDEX `VolunteerComment_userId_editionId_key` ON `VolunteerComment`;
DROP INDEX `VolunteerNotificationGroup_editionId_idx` ON `VolunteerNotificationGroup`;
DROP INDEX `VolunteerTeam_editionId_idx` ON `VolunteerTeam`;
DROP INDEX `VolunteerTimeSlot_editionId_idx` ON `VolunteerTimeSlot`;

-- 5. RENOMMAGE editionId -> eventId (préserve les valeurs ; editionId == Event.id grâce au backfill).
ALTER TABLE `EditionVolunteerApplication` CHANGE COLUMN `editionId` `eventId` INTEGER NOT NULL;
ALTER TABLE `VolunteerComment` CHANGE COLUMN `editionId` `eventId` INTEGER NOT NULL;
ALTER TABLE `VolunteerNotificationGroup` CHANGE COLUMN `editionId` `eventId` INTEGER NOT NULL;
ALTER TABLE `VolunteerTeam` CHANGE COLUMN `editionId` `eventId` INTEGER NOT NULL;
ALTER TABLE `VolunteerTimeSlot` CHANGE COLUMN `editionId` `eventId` INTEGER NOT NULL;

-- 6. Recréation des index sur eventId.
CREATE UNIQUE INDEX `Edition_eventId_key` ON `Edition`(`eventId`);
CREATE INDEX `EditionVolunteerApplication_eventId_idx` ON `EditionVolunteerApplication`(`eventId`);
CREATE UNIQUE INDEX `EditionVolunteerApplication_eventId_userId_key` ON `EditionVolunteerApplication`(`eventId`, `userId`);
CREATE INDEX `VolunteerComment_eventId_idx` ON `VolunteerComment`(`eventId`);
CREATE UNIQUE INDEX `VolunteerComment_userId_eventId_key` ON `VolunteerComment`(`userId`, `eventId`);
CREATE INDEX `VolunteerNotificationGroup_eventId_idx` ON `VolunteerNotificationGroup`(`eventId`);
CREATE INDEX `VolunteerTeam_eventId_idx` ON `VolunteerTeam`(`eventId`);
CREATE INDEX `VolunteerTimeSlot_eventId_idx` ON `VolunteerTimeSlot`(`eventId`);

-- 7. Clés étrangères vers Event (+ ré-ajout de la FK userId de VolunteerComment, supprimée en 4).
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerTeam` ADD CONSTRAINT `VolunteerTeam_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerTimeSlot` ADD CONSTRAINT `VolunteerTimeSlot_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerComment` ADD CONSTRAINT `VolunteerComment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerComment` ADD CONSTRAINT `VolunteerComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

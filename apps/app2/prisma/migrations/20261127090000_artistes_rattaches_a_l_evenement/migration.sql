-- Artistes, spectacles et groupes de notifications rattachés pour de bon à leur événement.
--
-- `prisma format` avait inventé sur ces trois tables une relation `eventId` (jamais écrite, NULL
-- partout) au lieu de la vraie relation sur `editionId`. Sans clé étrangère, supprimer un événement
-- laissait ses artistes et ses spectacles en base, rattachés à rien et invisibles.
--
-- 1. Purge des lignes déjà orphelines (décision du 26/11/2026). Toutes les tables qui les
--    référencent suivent en cascade (ou passent à NULL) : la suppression ne peut pas buter.
DELETE FROM `Show` WHERE `editionId` NOT IN (SELECT `id` FROM `Event`);
DELETE FROM `EditionArtist` WHERE `editionId` NOT IN (SELECT `id` FROM `Event`);
DELETE FROM `ArtistNotificationGroup` WHERE `editionId` NOT IN (SELECT `id` FROM `Event`);

-- 2. Retrait de la colonne inventée, puis vraie relation, en cascade.
-- DropForeignKey
ALTER TABLE `ArtistNotificationGroup` DROP FOREIGN KEY `ArtistNotificationGroup_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `EditionArtist` DROP FOREIGN KEY `EditionArtist_eventId_fkey`;

-- DropForeignKey
ALTER TABLE `Show` DROP FOREIGN KEY `Show_eventId_fkey`;

-- DropIndex
DROP INDEX `ArtistNotificationGroup_eventId_fkey` ON `ArtistNotificationGroup`;

-- DropIndex
DROP INDEX `EditionArtist_eventId_fkey` ON `EditionArtist`;

-- DropIndex
DROP INDEX `Show_eventId_fkey` ON `Show`;

-- AlterTable
ALTER TABLE `ArtistNotificationGroup` DROP COLUMN `eventId`;

-- AlterTable
ALTER TABLE `EditionArtist` DROP COLUMN `eventId`;

-- AlterTable
ALTER TABLE `Show` DROP COLUMN `eventId`;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationGroup` ADD CONSTRAINT `ArtistNotificationGroup_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


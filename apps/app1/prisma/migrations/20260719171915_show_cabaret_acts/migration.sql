/*
  Warnings:

  - A unique constraint covering the columns `[showId,actId,artistId]` on the table `ShowArtist` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `ShowArtist` DROP FOREIGN KEY `ShowArtist_showId_fkey`;

-- DropIndex
DROP INDEX `ShowArtist_showId_artistId_key` ON `ShowArtist`;

-- AlterTable
ALTER TABLE `Show` ADD COLUMN `type` ENUM('STANDARD', 'CABARET') NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE `ShowArtist` ADD COLUMN `actId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ShowAct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `duration` INTEGER NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowAct_showId_idx`(`showId`),
    INDEX `ShowAct_showId_position_idx`(`showId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ShowArtist_actId_idx` ON `ShowArtist`(`actId`);

-- CreateIndex
CREATE UNIQUE INDEX `ShowArtist_showId_actId_artistId_key` ON `ShowArtist`(`showId`, `actId`, `artistId`);

-- AddForeignKey
ALTER TABLE `ShowAct` ADD CONSTRAINT `ShowAct_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_actId_fkey` FOREIGN KEY (`actId`) REFERENCES `ShowAct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- Recrée la clé étrangère supprimée en début de migration pour pouvoir remplacer l'index
-- unique de ShowArtist. La génération automatique l'avait omise.
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

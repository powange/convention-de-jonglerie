/*
  Warnings:

  - A unique constraint covering the columns `[editionId,returnableItemId,teamId]` on the table `EditionVolunteerReturnableItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` DROP FOREIGN KEY `EditionVolunteerReturnableItem_editionId_fkey`;

-- DropIndex
DROP INDEX `EditionVolunteerReturnableItem_editionId_returnableItemId_key` ON `EditionVolunteerReturnableItem`;

-- AlterTable
ALTER TABLE `EditionVolunteerReturnableItem` ADD COLUMN `teamId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `EditionVolunteerReturnableItem_teamId_idx` ON `EditionVolunteerReturnableItem`(`teamId`);

-- CreateIndex
CREATE UNIQUE INDEX `EditionVolunteerReturnableItem_editionId_returnableItemId_te_key` ON `EditionVolunteerReturnableItem`(`editionId`, `returnableItemId`, `teamId`);

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

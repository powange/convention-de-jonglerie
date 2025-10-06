/*
  Warnings:

  - You are about to drop the `ReturnableItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` DROP FOREIGN KEY `EditionVolunteerReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `ReturnableItem` DROP FOREIGN KEY `ReturnableItem_editionId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingOptionReturnableItem` DROP FOREIGN KEY `TicketingOptionReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingTierReturnableItem` DROP FOREIGN KEY `TicketingTierReturnableItem_returnableItemId_fkey`;

-- RenameTable
RENAME TABLE `ReturnableItem` TO `TicketingReturnableItem`;

-- AddForeignKey
ALTER TABLE `TicketingReturnableItem` ADD CONSTRAINT `TicketingReturnableItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierReturnableItem` ADD CONSTRAINT `TicketingTierReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionReturnableItem` ADD CONSTRAINT `TicketingOptionReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `TicketingReturnableItem` RENAME INDEX `ReturnableItem_editionId_idx` TO `TicketingReturnableItem_editionId_idx`;

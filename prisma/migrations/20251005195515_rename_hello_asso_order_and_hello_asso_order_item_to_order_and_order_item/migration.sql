/*
  Warnings:

  - You are about to drop the `HelloAssoOrder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HelloAssoOrderItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `HelloAssoOrder` DROP FOREIGN KEY `HelloAssoOrder_editionId_fkey`;

-- DropForeignKey
ALTER TABLE `HelloAssoOrder` DROP FOREIGN KEY `HelloAssoOrder_externalTicketingId_fkey`;

-- DropForeignKey
ALTER TABLE `HelloAssoOrderItem` DROP FOREIGN KEY `HelloAssoOrderItem_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `HelloAssoOrderItem` DROP FOREIGN KEY `HelloAssoOrderItem_tierId_fkey`;

-- RenameTable
RENAME TABLE `HelloAssoOrder` TO `TicketingOrder`;

-- RenameTable
RENAME TABLE `HelloAssoOrderItem` TO `TicketingOrderItem`;

-- AddForeignKey
ALTER TABLE `TicketingOrder` ADD CONSTRAINT `TicketingOrder_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrder` ADD CONSTRAINT `TicketingOrder_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItem` ADD CONSTRAINT `TicketingOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `TicketingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItem` ADD CONSTRAINT `TicketingOrderItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `HelloAssoTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

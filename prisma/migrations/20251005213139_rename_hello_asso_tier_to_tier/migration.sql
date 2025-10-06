/*
  Warnings:

  - You are about to drop the `HelloAssoTier` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `HelloAssoTier` DROP FOREIGN KEY `HelloAssoTier_editionId_fkey`;

-- DropForeignKey
ALTER TABLE `HelloAssoTier` DROP FOREIGN KEY `HelloAssoTier_externalTicketingId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingOrderItem` DROP FOREIGN KEY `TicketingOrderItem_tierId_fkey`;

-- DropForeignKey
ALTER TABLE `TierQuota` DROP FOREIGN KEY `TierQuota_tierId_fkey`;

-- DropForeignKey
ALTER TABLE `TierReturnableItem` DROP FOREIGN KEY `TierReturnableItem_tierId_fkey`;

-- RenameTable
RENAME TABLE `HelloAssoTier` TO `TicketingTier`;

-- AddForeignKey
ALTER TABLE `TicketingTier` ADD CONSTRAINT `TicketingTier_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTier` ADD CONSTRAINT `TicketingTier_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TierQuota` ADD CONSTRAINT `TierQuota_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TierReturnableItem` ADD CONSTRAINT `TierReturnableItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItem` ADD CONSTRAINT `TicketingOrderItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `TicketingOrder` RENAME INDEX `HelloAssoOrder_editionId_idx` TO `TicketingOrder_editionId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrder` RENAME INDEX `HelloAssoOrder_externalTicketingId_helloAssoOrderId_key` TO `TicketingOrder_externalTicketingId_helloAssoOrderId_key`;

-- RenameIndex
ALTER TABLE `TicketingOrder` RENAME INDEX `HelloAssoOrder_externalTicketingId_idx` TO `TicketingOrder_externalTicketingId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrder` RENAME INDEX `HelloAssoOrder_payerEmail_idx` TO `TicketingOrder_payerEmail_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrderItem` RENAME INDEX `HelloAssoOrderItem_email_idx` TO `TicketingOrderItem_email_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrderItem` RENAME INDEX `HelloAssoOrderItem_entryValidated_idx` TO `TicketingOrderItem_entryValidated_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrderItem` RENAME INDEX `HelloAssoOrderItem_helloAssoItemId_idx` TO `TicketingOrderItem_helloAssoItemId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrderItem` RENAME INDEX `HelloAssoOrderItem_orderId_idx` TO `TicketingOrderItem_orderId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrderItem` RENAME INDEX `HelloAssoOrderItem_qrCode_idx` TO `TicketingOrderItem_qrCode_idx`;

-- RenameIndex
ALTER TABLE `TicketingOrderItem` RENAME INDEX `HelloAssoOrderItem_tierId_idx` TO `TicketingOrderItem_tierId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTier` RENAME INDEX `HelloAssoTier_editionId_idx` TO `TicketingTier_editionId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTier` RENAME INDEX `HelloAssoTier_externalTicketingId_helloAssoTierId_key` TO `TicketingTier_externalTicketingId_helloAssoTierId_key`;

-- RenameIndex
ALTER TABLE `TicketingTier` RENAME INDEX `HelloAssoTier_externalTicketingId_idx` TO `TicketingTier_externalTicketingId_idx`;
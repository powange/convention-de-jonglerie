/*
  Warnings:

  - You are about to drop the `TierReturnableItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `TierReturnableItem` DROP FOREIGN KEY `TierReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `TierReturnableItem` DROP FOREIGN KEY `TierReturnableItem_tierId_fkey`;

-- RenameTable
RENAME TABLE `TierReturnableItem` TO `TicketingTierReturnableItem`;

-- AddForeignKey
ALTER TABLE `TicketingTierReturnableItem` ADD CONSTRAINT `TicketingTierReturnableItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierReturnableItem` ADD CONSTRAINT `TicketingTierReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `ReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `TicketingTierReturnableItem` RENAME INDEX `TierReturnableItem_returnableItemId_idx` TO `TicketingTierReturnableItem_returnableItemId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierReturnableItem` RENAME INDEX `TierReturnableItem_tierId_idx` TO `TicketingTierReturnableItem_tierId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierReturnableItem` RENAME INDEX `TierReturnableItem_tierId_returnableItemId_key` TO `TicketingTierReturnableItem_tierId_returnableItemId_key`;

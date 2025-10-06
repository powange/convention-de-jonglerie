/*
  Warnings:

  - You are about to drop the `OptionReturnableItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `OptionReturnableItem` DROP FOREIGN KEY `OptionReturnableItem_optionId_fkey`;

-- DropForeignKey
ALTER TABLE `OptionReturnableItem` DROP FOREIGN KEY `OptionReturnableItem_returnableItemId_fkey`;

-- RenameTable
RENAME TABLE `OptionReturnableItem` TO `TicketingOptionReturnableItem`;

-- AddForeignKey
ALTER TABLE `TicketingOptionReturnableItem` ADD CONSTRAINT `TicketingOptionReturnableItem_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionReturnableItem` ADD CONSTRAINT `TicketingOptionReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `ReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `TicketingOptionQuota` RENAME INDEX `OptionQuota_optionId_idx` TO `TicketingOptionQuota_optionId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOptionQuota` RENAME INDEX `OptionQuota_optionId_quotaId_key` TO `TicketingOptionQuota_optionId_quotaId_key`;

-- RenameIndex
ALTER TABLE `TicketingOptionQuota` RENAME INDEX `OptionQuota_quotaId_idx` TO `TicketingOptionQuota_quotaId_idx`;

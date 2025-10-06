/*
  Warnings:

  - You are about to drop the `OptionQuota` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `OptionQuota` DROP FOREIGN KEY `OptionQuota_optionId_fkey`;

-- DropForeignKey
ALTER TABLE `OptionQuota` DROP FOREIGN KEY `OptionQuota_quotaId_fkey`;

-- RenameTable
RENAME TABLE `OptionQuota` TO `TicketingOptionQuota`;

-- AddForeignKey
ALTER TABLE `TicketingOptionQuota` ADD CONSTRAINT `TicketingOptionQuota_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionQuota` ADD CONSTRAINT `TicketingOptionQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `TicketingTierQuota` RENAME INDEX `TierQuota_quotaId_idx` TO `TicketingTierQuota_quotaId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierQuota` RENAME INDEX `TierQuota_tierId_idx` TO `TicketingTierQuota_tierId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierQuota` RENAME INDEX `TierQuota_tierId_quotaId_key` TO `TicketingTierQuota_tierId_quotaId_key`;

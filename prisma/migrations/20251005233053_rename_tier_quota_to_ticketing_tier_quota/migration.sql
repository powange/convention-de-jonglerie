/*
  Warnings:

  - You are about to drop the `TierQuota` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `TierQuota` DROP FOREIGN KEY `TierQuota_quotaId_fkey`;

-- DropForeignKey
ALTER TABLE `TierQuota` DROP FOREIGN KEY `TierQuota_tierId_fkey`;

-- RenameTable
RENAME TABLE `TierQuota` TO `TicketingTierQuota`;

-- AddForeignKey
ALTER TABLE `TicketingTierQuota` ADD CONSTRAINT `TicketingTierQuota_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierQuota` ADD CONSTRAINT `TicketingTierQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `TicketingOption` RENAME INDEX `HelloAssoOption_editionId_idx` TO `TicketingOption_editionId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOption` RENAME INDEX `HelloAssoOption_externalTicketingId_helloAssoOptionId_key` TO `TicketingOption_externalTicketingId_helloAssoOptionId_key`;

-- RenameIndex
ALTER TABLE `TicketingOption` RENAME INDEX `HelloAssoOption_externalTicketingId_idx` TO `TicketingOption_externalTicketingId_idx`;

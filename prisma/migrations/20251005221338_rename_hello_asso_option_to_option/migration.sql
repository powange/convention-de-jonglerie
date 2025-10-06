/*
  Warnings:

  - You are about to drop the `HelloAssoOption` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `HelloAssoOption` DROP FOREIGN KEY `HelloAssoOption_editionId_fkey`;

-- DropForeignKey
ALTER TABLE `HelloAssoOption` DROP FOREIGN KEY `HelloAssoOption_externalTicketingId_fkey`;

-- DropForeignKey
ALTER TABLE `OptionQuota` DROP FOREIGN KEY `OptionQuota_optionId_fkey`;

-- DropForeignKey
ALTER TABLE `OptionReturnableItem` DROP FOREIGN KEY `OptionReturnableItem_optionId_fkey`;

-- RenameTable
RENAME TABLE `HelloAssoOption` TO `TicketingOption`;

-- AddForeignKey
ALTER TABLE `OptionQuota` ADD CONSTRAINT `OptionQuota_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptionReturnableItem` ADD CONSTRAINT `OptionReturnableItem_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOption` ADD CONSTRAINT `TicketingOption_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOption` ADD CONSTRAINT `TicketingOption_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

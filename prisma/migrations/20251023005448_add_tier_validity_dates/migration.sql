-- AlterTable
ALTER TABLE `TicketingTier` ADD COLUMN `validFrom` DATETIME(3) NULL,
    ADD COLUMN `validUntil` DATETIME(3) NULL;

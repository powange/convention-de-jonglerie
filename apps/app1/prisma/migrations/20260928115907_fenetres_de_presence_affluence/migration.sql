-- AlterTable
ALTER TABLE `EditionOrganizer` ADD COLUMN `arrivalDateTime` VARCHAR(191) NULL,
    ADD COLUMN `departureDateTime` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `TicketingTier` ADD COLUMN `presenceFrom` DATETIME(3) NULL,
    ADD COLUMN `presenceUntil` DATETIME(3) NULL;

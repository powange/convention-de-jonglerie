-- AlterTable
ALTER TABLE `EditionOrganizer` ADD COLUMN `canManageArtists` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageMeals` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageStock` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageTicketing` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageTreasury` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `artistsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mealsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `siteMapEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `stockEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ticketingEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `treasuryEnabled` BOOLEAN NOT NULL DEFAULT false;


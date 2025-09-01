-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskCompanion` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `companionName` VARCHAR(191) NULL;

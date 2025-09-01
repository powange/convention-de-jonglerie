-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskAvoidList` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `avoidList` TEXT NULL;

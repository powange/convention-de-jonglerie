-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskSkills` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `skills` TEXT NULL;

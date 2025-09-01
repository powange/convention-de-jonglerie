-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskExperience` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `experienceDetails` TEXT NULL,
    ADD COLUMN `hasExperience` BOOLEAN NULL;

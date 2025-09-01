-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskMinors` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable  
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `hasMinors` BOOLEAN NULL,
    ADD COLUMN `minorsDetails` TEXT NULL;
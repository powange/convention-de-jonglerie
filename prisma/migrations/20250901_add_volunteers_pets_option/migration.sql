-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskPets` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable  
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `hasPets` BOOLEAN NULL,
    ADD COLUMN `petsDetails` TEXT NULL;
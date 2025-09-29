-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskEmergencyContact` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `emergencyContactName` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL;
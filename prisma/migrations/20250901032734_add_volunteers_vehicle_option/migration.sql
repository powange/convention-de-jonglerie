-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersAskVehicle` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `hasVehicle` BOOLEAN NULL,
    ADD COLUMN `vehicleDetails` TEXT NULL;

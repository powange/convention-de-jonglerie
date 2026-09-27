-- AlterTable
ALTER TABLE `VolunteerTeam` ADD COLUMN `coversEvent` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `coversSetup` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `coversTeardown` BOOLEAN NOT NULL DEFAULT true;

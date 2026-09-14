-- AlterTable
ALTER TABLE `EventVolunteerSettings` ADD COLUMN `autoAssignConstraints` JSON NULL;

-- AlterTable
ALTER TABLE `VolunteerAutoAssignRun` ADD COLUMN `empreinteApres` VARCHAR(191) NULL;

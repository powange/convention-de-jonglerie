-- AlterTable
ALTER TABLE `OrganizerMealSelection` ADD COLUMN `afterShow` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `VolunteerMealSelection` ADD COLUMN `afterShow` BOOLEAN NOT NULL DEFAULT false;

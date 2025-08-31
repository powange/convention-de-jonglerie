-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersTeams` JSON NULL;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `teamPreferences` JSON NULL;
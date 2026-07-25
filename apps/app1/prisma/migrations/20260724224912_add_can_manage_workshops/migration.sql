-- AlterTable
ALTER TABLE `ConventionOrganizer` ADD COLUMN `canManageWorkshops` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionOrganizerPermission` ADD COLUMN `canManageWorkshops` BOOLEAN NOT NULL DEFAULT false;

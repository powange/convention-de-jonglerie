-- AlterTable
ALTER TABLE `ConventionOrganizer` ADD COLUMN `canManageFAQ` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionOrganizerPermission` ADD COLUMN `canManageFAQ` BOOLEAN NOT NULL DEFAULT false;

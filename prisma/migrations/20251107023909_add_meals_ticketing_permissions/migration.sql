-- DropForeignKey
ALTER TABLE `EditionOrganizerPermission` DROP FOREIGN KEY `EditionCollaboratorPermission_editionId_fkey`;

-- AlterTable
ALTER TABLE `ConventionOrganizer` ADD COLUMN `canManageMeals` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageTicketing` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionOrganizerPermission` ADD COLUMN `canManageMeals` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageTicketing` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `EditionOrganizerPermission` ADD CONSTRAINT `EditionOrganizerPermission_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `EditionOrganizerPermission` RENAME INDEX `EditionCollaboratorPermission_editionId_idx` TO `EditionOrganizerPermission_editionId_idx`;

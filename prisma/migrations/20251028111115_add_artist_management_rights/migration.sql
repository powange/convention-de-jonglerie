-- AlterTable
ALTER TABLE `ConventionCollaborator` ADD COLUMN `canManageArtists` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionCollaboratorPermission` ADD COLUMN `canManageArtists` BOOLEAN NOT NULL DEFAULT false;

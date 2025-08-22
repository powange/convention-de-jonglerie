-- AlterTable
ALTER TABLE `Convention` ADD COLUMN `archivedAt` DATETIME(3) NULL,
    ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `ConventionCollaborator` ADD COLUMN `canAddEdition` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canDeleteAllEditions` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canDeleteConvention` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canEditAllEditions` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canEditConvention` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageCollaborators` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `title` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `EditionCollaboratorPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `collaboratorId` INTEGER NOT NULL,
    `editionId` INTEGER NOT NULL,
    `canEdit` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,

    INDEX `EditionCollaboratorPermission_editionId_idx`(`editionId`),
    UNIQUE INDEX `EditionCollaboratorPermission_collaboratorId_editionId_key`(`collaboratorId`, `editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollaboratorPermissionHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `collaboratorId` INTEGER NULL,
    `actorId` INTEGER NOT NULL,
    `changeType` ENUM('CREATED', 'RIGHTS_UPDATED', 'PER_EDITIONS_UPDATED', 'ARCHIVED', 'UNARCHIVED', 'REMOVED') NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CollaboratorPermissionHistory_conventionId_idx`(`conventionId`),
    INDEX `CollaboratorPermissionHistory_actorId_idx`(`actorId`),
    INDEX `CollaboratorPermissionHistory_collaboratorId_idx`(`collaboratorId`),
    INDEX `CollaboratorPermissionHistory_changeType_idx`(`changeType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionCollaboratorPermission` ADD CONSTRAINT `EditionCollaboratorPermission_collaboratorId_fkey` FOREIGN KEY (`collaboratorId`) REFERENCES `ConventionCollaborator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionCollaboratorPermission` ADD CONSTRAINT `EditionCollaboratorPermission_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_collaboratorId_fkey` FOREIGN KEY (`collaboratorId`) REFERENCES `ConventionCollaborator`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

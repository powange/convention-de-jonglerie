-- DropForeignKey
ALTER TABLE `ApiErrorLog` DROP FOREIGN KEY `ApiErrorLog_resolvedBy_fkey`;

-- DropForeignKey
ALTER TABLE `CarpoolPassenger` DROP FOREIGN KEY `CarpoolPassenger_addedById_fkey`;

-- DropForeignKey
ALTER TABLE `CollaboratorPermissionHistory` DROP FOREIGN KEY `CollaboratorPermissionHistory_actorId_fkey`;

-- DropForeignKey
ALTER TABLE `CollaboratorPermissionHistory` DROP FOREIGN KEY `CollaboratorPermissionHistory_targetUserId_fkey`;

-- DropIndex
DROP INDEX `ApiErrorLog_resolvedBy_fkey` ON `ApiErrorLog`;

-- DropIndex
DROP INDEX `CarpoolPassenger_addedById_fkey` ON `CarpoolPassenger`;

-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PushSubscription_userId_idx`(`userId`),
    UNIQUE INDEX `PushSubscription_userId_endpoint_key`(`userId`, `endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `ApiErrorLog` RENAME INDEX `ApiErrorLog_userId_fkey` TO `ApiErrorLog_userId_idx`;

-- RenameIndex
ALTER TABLE `CollaboratorPermissionHistory` RENAME INDEX `CollaboratorPermissionHistory_actorId_fkey` TO `CollaboratorPermissionHistory_actorId_idx`;

-- RenameIndex
ALTER TABLE `CollaboratorPermissionHistory` RENAME INDEX `CollaboratorPermissionHistory_conventionId_fkey` TO `CollaboratorPermissionHistory_conventionId_idx`;

-- RenameIndex
ALTER TABLE `CollaboratorPermissionHistory` RENAME INDEX `CollaboratorPermissionHistory_targetUserId_fkey` TO `CollaboratorPermissionHistory_targetUserId_idx`;

-- RenameIndex
ALTER TABLE `EditionCollaboratorPermission` RENAME INDEX `EditionCollaboratorPermission_editionId_fkey` TO `EditionCollaboratorPermission_editionId_idx`;

-- RenameIndex
ALTER TABLE `EditionVolunteerApplication` RENAME INDEX `EditionVolunteerApplication_editionId_fkey` TO `EditionVolunteerApplication_editionId_idx`;

-- DropForeignKey (avec vérification d'existence)
SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ApiErrorLog' 
    AND CONSTRAINT_NAME = 'ApiErrorLog_resolvedBy_fkey');
SET @sql = IF(@constraint_exists > 0, 'ALTER TABLE `ApiErrorLog` DROP FOREIGN KEY `ApiErrorLog_resolvedBy_fkey`', 'SELECT "Constraint ApiErrorLog_resolvedBy_fkey does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'CarpoolPassenger' 
    AND CONSTRAINT_NAME = 'CarpoolPassenger_addedById_fkey');
SET @sql = IF(@constraint_exists > 0, 'ALTER TABLE `CarpoolPassenger` DROP FOREIGN KEY `CarpoolPassenger_addedById_fkey`', 'SELECT "Constraint CarpoolPassenger_addedById_fkey does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'CollaboratorPermissionHistory' 
    AND CONSTRAINT_NAME = 'CollaboratorPermissionHistory_actorId_fkey');
SET @sql = IF(@constraint_exists > 0, 'ALTER TABLE `CollaboratorPermissionHistory` DROP FOREIGN KEY `CollaboratorPermissionHistory_actorId_fkey`', 'SELECT "Constraint CollaboratorPermissionHistory_actorId_fkey does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'CollaboratorPermissionHistory' 
    AND CONSTRAINT_NAME = 'CollaboratorPermissionHistory_targetUserId_fkey');
SET @sql = IF(@constraint_exists > 0, 'ALTER TABLE `CollaboratorPermissionHistory` DROP FOREIGN KEY `CollaboratorPermissionHistory_targetUserId_fkey`', 'SELECT "Constraint CollaboratorPermissionHistory_targetUserId_fkey does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (avec vérification d'existence)
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ApiErrorLog' 
    AND INDEX_NAME = 'ApiErrorLog_resolvedBy_fkey');
SET @sql = IF(@index_exists > 0, 'DROP INDEX `ApiErrorLog_resolvedBy_fkey` ON `ApiErrorLog`', 'SELECT "Index ApiErrorLog_resolvedBy_fkey does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'CarpoolPassenger' 
    AND INDEX_NAME = 'CarpoolPassenger_addedById_fkey');
SET @sql = IF(@index_exists > 0, 'DROP INDEX `CarpoolPassenger_addedById_fkey` ON `CarpoolPassenger`', 'SELECT "Index CarpoolPassenger_addedById_fkey does not exist" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CreateTable (avec vérification d'existence)
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'PushSubscription');
SET @sql = IF(@table_exists = 0, '
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
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', 'SELECT "Table PushSubscription already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AddForeignKey (avec vérification d'existence)
SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'CollaboratorPermissionHistory' 
    AND CONSTRAINT_NAME = 'CollaboratorPermissionHistory_actorId_fkey');
SET @sql = IF(@constraint_exists = 0, 'ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT "Constraint CollaboratorPermissionHistory_actorId_fkey already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'CollaboratorPermissionHistory' 
    AND CONSTRAINT_NAME = 'CollaboratorPermissionHistory_targetUserId_fkey');
SET @sql = IF(@constraint_exists = 0, 'ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT "Constraint CollaboratorPermissionHistory_targetUserId_fkey already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'PushSubscription' 
    AND CONSTRAINT_NAME = 'PushSubscription_userId_fkey');
SET @sql = IF(@constraint_exists = 0, 'ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT "Constraint PushSubscription_userId_fkey already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- RenameIndex (avec vérifications d'existence)
SET @old_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ApiErrorLog' AND INDEX_NAME = 'ApiErrorLog_userId_fkey');
SET @new_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ApiErrorLog' AND INDEX_NAME = 'ApiErrorLog_userId_idx');
SET @sql = IF(@old_index_exists > 0 AND @new_index_exists = 0, 'ALTER TABLE `ApiErrorLog` RENAME INDEX `ApiErrorLog_userId_fkey` TO `ApiErrorLog_userId_idx`', 'SELECT "Index ApiErrorLog_userId_fkey rename not needed" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @old_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CollaboratorPermissionHistory' AND INDEX_NAME = 'CollaboratorPermissionHistory_actorId_fkey');
SET @new_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CollaboratorPermissionHistory' AND INDEX_NAME = 'CollaboratorPermissionHistory_actorId_idx');
SET @sql = IF(@old_index_exists > 0 AND @new_index_exists = 0, 'ALTER TABLE `CollaboratorPermissionHistory` RENAME INDEX `CollaboratorPermissionHistory_actorId_fkey` TO `CollaboratorPermissionHistory_actorId_idx`', 'SELECT "Index CollaboratorPermissionHistory_actorId_fkey rename not needed" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @old_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CollaboratorPermissionHistory' AND INDEX_NAME = 'CollaboratorPermissionHistory_conventionId_fkey');
SET @new_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CollaboratorPermissionHistory' AND INDEX_NAME = 'CollaboratorPermissionHistory_conventionId_idx');
SET @sql = IF(@old_index_exists > 0 AND @new_index_exists = 0, 'ALTER TABLE `CollaboratorPermissionHistory` RENAME INDEX `CollaboratorPermissionHistory_conventionId_fkey` TO `CollaboratorPermissionHistory_conventionId_idx`', 'SELECT "Index CollaboratorPermissionHistory_conventionId_fkey rename not needed" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @old_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CollaboratorPermissionHistory' AND INDEX_NAME = 'CollaboratorPermissionHistory_targetUserId_fkey');
SET @new_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CollaboratorPermissionHistory' AND INDEX_NAME = 'CollaboratorPermissionHistory_targetUserId_idx');
SET @sql = IF(@old_index_exists > 0 AND @new_index_exists = 0, 'ALTER TABLE `CollaboratorPermissionHistory` RENAME INDEX `CollaboratorPermissionHistory_targetUserId_fkey` TO `CollaboratorPermissionHistory_targetUserId_idx`', 'SELECT "Index CollaboratorPermissionHistory_targetUserId_fkey rename not needed" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @old_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EditionCollaboratorPermission' AND INDEX_NAME = 'EditionCollaboratorPermission_editionId_fkey');
SET @new_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EditionCollaboratorPermission' AND INDEX_NAME = 'EditionCollaboratorPermission_editionId_idx');
SET @sql = IF(@old_index_exists > 0 AND @new_index_exists = 0, 'ALTER TABLE `EditionCollaboratorPermission` RENAME INDEX `EditionCollaboratorPermission_editionId_fkey` TO `EditionCollaboratorPermission_editionId_idx`', 'SELECT "Index EditionCollaboratorPermission_editionId_fkey rename not needed" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @old_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EditionVolunteerApplication' AND INDEX_NAME = 'EditionVolunteerApplication_editionId_fkey');
SET @new_index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EditionVolunteerApplication' AND INDEX_NAME = 'EditionVolunteerApplication_editionId_idx');
SET @sql = IF(@old_index_exists > 0 AND @new_index_exists = 0, 'ALTER TABLE `EditionVolunteerApplication` RENAME INDEX `EditionVolunteerApplication_editionId_fkey` TO `EditionVolunteerApplication_editionId_idx`', 'SELECT "Index EditionVolunteerApplication_editionId_fkey rename not needed" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

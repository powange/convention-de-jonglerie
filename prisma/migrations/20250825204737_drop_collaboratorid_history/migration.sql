/*
  Warnings:

  - You are about to drop the column `collaboratorId` on the `CollaboratorPermissionHistory` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `CollaboratorPermissionHistory` DROP FOREIGN KEY `CollaboratorPermissionHistory_collaboratorId_fkey`;

-- DropIndex
DROP INDEX `CollaboratorPermissionHistory_collaboratorId_idx` ON `CollaboratorPermissionHistory`;

-- AlterTable
ALTER TABLE `CollaboratorPermissionHistory` DROP COLUMN `collaboratorId`,
    ADD COLUMN `targetUserId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `CollaboratorPermissionHistory_targetUserId_idx` ON `CollaboratorPermissionHistory`(`targetUserId`);

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

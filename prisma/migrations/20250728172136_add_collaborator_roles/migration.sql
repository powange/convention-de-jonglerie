/*
  Warnings:

  - You are about to drop the column `canEdit` on the `ConventionCollaborator` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `ConventionCollaborator` DROP FOREIGN KEY `ConventionCollaborator_conventionId_fkey`;

-- AlterTable
ALTER TABLE `ConventionCollaborator` DROP COLUMN `canEdit`,
    ADD COLUMN `role` ENUM('MODERATOR', 'ADMINISTRATOR') NOT NULL DEFAULT 'MODERATOR';

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

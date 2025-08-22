-- DropForeignKey
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `ConventionCollaborator` DROP FOREIGN KEY `ConventionCollaborator_addedById_fkey`;

-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_conventionId_fkey`;

-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_creatorId_fkey`;

-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `isOnline` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

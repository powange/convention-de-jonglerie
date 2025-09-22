-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_conventionId_fkey`;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

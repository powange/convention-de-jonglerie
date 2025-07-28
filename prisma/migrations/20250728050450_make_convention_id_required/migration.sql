/*
  Warnings:

  - Made the column `conventionId` on table `Edition` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_conventionId_fkey`;

-- AlterTable
ALTER TABLE `Edition` MODIFY `conventionId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

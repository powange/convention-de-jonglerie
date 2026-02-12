/*
  Warnings:

  - A unique constraint covering the columns `[showId]` on the table `ShowApplication` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `ShowApplication` ADD COLUMN `showId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ShowApplication_showId_key` ON `ShowApplication`(`showId`);

-- AddForeignKey
ALTER TABLE `ShowApplication` ADD CONSTRAINT `ShowApplication_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

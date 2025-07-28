-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `conventionId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Edition_conventionId_fkey` ON `Edition`(`conventionId`);

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

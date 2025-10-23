-- AlterTable
ALTER TABLE `Workshop` ADD COLUMN `locationId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Workshop_locationId_idx` ON `Workshop`(`locationId`);

-- AddForeignKey
ALTER TABLE `Workshop` ADD CONSTRAINT `Workshop_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `WorkshopLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

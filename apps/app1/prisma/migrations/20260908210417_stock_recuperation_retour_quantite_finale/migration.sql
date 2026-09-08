-- AlterTable
ALTER TABLE `StockItem` ADD COLUMN `finalQuantity` INTEGER NULL,
    ADD COLUMN `pickupContact` TEXT NULL,
    ADD COLUMN `pickupLocation` TEXT NULL,
    ADD COLUMN `pickupResponsibleId` INTEGER NULL,
    ADD COLUMN `returnContact` TEXT NULL,
    ADD COLUMN `returnLocation` TEXT NULL,
    ADD COLUMN `returnResponsibleId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `StockItem_pickupResponsibleId_idx` ON `StockItem`(`pickupResponsibleId`);

-- CreateIndex
CREATE INDEX `StockItem_returnResponsibleId_idx` ON `StockItem`(`returnResponsibleId`);

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_pickupResponsibleId_fkey` FOREIGN KEY (`pickupResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_returnResponsibleId_fkey` FOREIGN KEY (`returnResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

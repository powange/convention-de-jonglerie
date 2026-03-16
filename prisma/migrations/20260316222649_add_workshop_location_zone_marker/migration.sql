-- AlterTable
ALTER TABLE `WorkshopLocation` ADD COLUMN `markerId` INTEGER NULL,
    ADD COLUMN `zoneId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `WorkshopLocation_zoneId_idx` ON `WorkshopLocation`(`zoneId`);

-- CreateIndex
CREATE INDEX `WorkshopLocation_markerId_idx` ON `WorkshopLocation`(`markerId`);

-- AddForeignKey
ALTER TABLE `WorkshopLocation` ADD CONSTRAINT `WorkshopLocation_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkshopLocation` ADD CONSTRAINT `WorkshopLocation_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Show` ADD COLUMN `imageUrl` VARCHAR(191) NULL,
    ADD COLUMN `markerId` INTEGER NULL,
    ADD COLUMN `zoneId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Show_zoneId_idx` ON `Show`(`zoneId`);

-- CreateIndex
CREATE INDEX `Show_markerId_idx` ON `Show`(`markerId`);

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

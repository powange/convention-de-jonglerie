-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `dropoffLocation` VARCHAR(191) NULL,
    ADD COLUMN `dropoffRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dropoffResponsibleId` INTEGER NULL,
    ADD COLUMN `pickupLocation` VARCHAR(191) NULL,
    ADD COLUMN `pickupRequired` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pickupResponsibleId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `EditionArtist_pickupResponsibleId_idx` ON `EditionArtist`(`pickupResponsibleId`);

-- CreateIndex
CREATE INDEX `EditionArtist_dropoffResponsibleId_idx` ON `EditionArtist`(`dropoffResponsibleId`);

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_pickupResponsibleId_fkey` FOREIGN KEY (`pickupResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_dropoffResponsibleId_fkey` FOREIGN KEY (`dropoffResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

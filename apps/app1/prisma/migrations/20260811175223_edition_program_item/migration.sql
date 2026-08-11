-- CreateTable
CREATE TABLE `EditionProgramItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `endDateTime` DATETIME(3) NULL,
    `locationName` VARCHAR(150) NULL,
    `zoneId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionProgramItem_editionId_idx`(`editionId`),
    INDEX `EditionProgramItem_editionId_isPublic_idx`(`editionId`, `isPublic`),
    INDEX `EditionProgramItem_startDateTime_idx`(`startDateTime`),
    INDEX `EditionProgramItem_zoneId_idx`(`zoneId`),
    INDEX `EditionProgramItem_markerId_idx`(`markerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionProgramItem` ADD CONSTRAINT `EditionProgramItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionProgramItem` ADD CONSTRAINT `EditionProgramItem_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionProgramItem` ADD CONSTRAINT `EditionProgramItem_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

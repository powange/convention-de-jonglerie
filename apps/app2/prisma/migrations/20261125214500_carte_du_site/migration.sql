-- AlterTable
ALTER TABLE `Event` ADD COLUMN `externalMapProvider` VARCHAR(191) NULL,
    ADD COLUMN `externalMapRef` VARCHAR(191) NULL,
    ADD COLUMN `mapPublic` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `EditionZone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NOT NULL,
    `coordinates` JSON NOT NULL,
    `zoneTypes` JSON NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `externalMapObjectId` VARCHAR(64) NULL,
    `externalMapImportedAt` DATETIME(3) NULL,

    INDEX `EditionZone_editionId_idx`(`editionId`),
    UNIQUE INDEX `EditionZone_editionId_externalMapObjectId_key`(`editionId`, `externalMapObjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionMarker` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `markerTypes` JSON NOT NULL,
    `color` VARCHAR(7) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `externalMapObjectId` VARCHAR(64) NULL,
    `externalMapImportedAt` DATETIME(3) NULL,
    `zoneId` INTEGER NULL,

    INDEX `EditionMarker_editionId_idx`(`editionId`),
    INDEX `EditionMarker_zoneId_idx`(`zoneId`),
    UNIQUE INDEX `EditionMarker_editionId_externalMapObjectId_key`(`editionId`, `externalMapObjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionZone` ADD CONSTRAINT `EditionZone_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionMarker` ADD CONSTRAINT `EditionMarker_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionMarker` ADD CONSTRAINT `EditionMarker_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


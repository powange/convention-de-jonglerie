-- CreateTable
CREATE TABLE `EditionZone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NOT NULL,
    `coordinates` JSON NOT NULL,
    `zoneType` ENUM('CAMPING', 'PARKING', 'SHOWS', 'WORKSHOPS', 'FOOD', 'MARKET', 'ENTRANCE', 'TOILETS', 'INFO', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionZone_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionZone` ADD CONSTRAINT `EditionZone_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

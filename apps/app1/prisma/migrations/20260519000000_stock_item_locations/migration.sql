-- CreateTable
CREATE TABLE `StockItemLocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockItemId` INTEGER NOT NULL,
    `location` VARCHAR(191) NULL,
    `zoneId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockItemLocation_stockItemId_idx`(`stockItemId`),
    INDEX `StockItemLocation_stockItemId_displayOrder_idx`(`stockItemId`, `displayOrder`),
    INDEX `StockItemLocation_zoneId_idx`(`zoneId`),
    INDEX `StockItemLocation_markerId_idx`(`markerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockItemLocation` ADD CONSTRAINT `StockItemLocation_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItemLocation` ADD CONSTRAINT `StockItemLocation_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItemLocation` ADD CONSTRAINT `StockItemLocation_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill : pour chaque StockItem ayant une localisation, créer une entrée
-- StockItemLocation avec la quantité totale de l'item.
INSERT INTO `StockItemLocation` (`stockItemId`, `location`, `zoneId`, `markerId`, `quantity`, `displayOrder`, `createdAt`, `updatedAt`)
SELECT
    `id`,
    NULLIF(TRIM(`location`), ''),
    `zoneId`,
    `markerId`,
    `quantity`,
    0,
    NOW(3),
    NOW(3)
FROM `StockItem`
WHERE (`location` IS NOT NULL AND TRIM(`location`) <> '')
   OR `zoneId` IS NOT NULL
   OR `markerId` IS NOT NULL;

-- DropForeignKey
ALTER TABLE `StockItem` DROP FOREIGN KEY `StockItem_zoneId_fkey`;

-- DropForeignKey
ALTER TABLE `StockItem` DROP FOREIGN KEY `StockItem_markerId_fkey`;

-- DropIndex
DROP INDEX `StockItem_zoneId_idx` ON `StockItem`;

-- DropIndex
DROP INDEX `StockItem_markerId_idx` ON `StockItem`;

-- AlterTable
ALTER TABLE `StockItem` DROP COLUMN `location`,
    DROP COLUMN `zoneId`,
    DROP COLUMN `markerId`;

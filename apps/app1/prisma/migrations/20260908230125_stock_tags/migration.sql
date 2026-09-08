-- CreateTable
CREATE TABLE `StockTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockTag_editionId_idx`(`editionId`),
    INDEX `StockTag_editionId_displayOrder_idx`(`editionId`, `displayOrder`),
    UNIQUE INDEX `StockTag_editionId_name_key`(`editionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTagAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockItemId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockTagAssignment_stockItemId_idx`(`stockItemId`),
    INDEX `StockTagAssignment_tagId_idx`(`tagId`),
    UNIQUE INDEX `StockTagAssignment_stockItemId_tagId_key`(`stockItemId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockTag` ADD CONSTRAINT `StockTag_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTagAssignment` ADD CONSTRAINT `StockTagAssignment_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTagAssignment` ADD CONSTRAINT `StockTagAssignment_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `StockTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

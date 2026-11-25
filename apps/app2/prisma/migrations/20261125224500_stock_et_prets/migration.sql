-- CreateTable
CREATE TABLE `StockGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `reservationsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockGroup_editionId_idx`(`editionId`),
    INDEX `StockGroup_editionId_displayOrder_idx`(`editionId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockGroupId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `notes` TEXT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isExternalLoan` BOOLEAN NOT NULL DEFAULT false,
    `ownerContact` TEXT NULL,
    `returnDueAt` DATETIME(3) NULL,
    `pickedUpAt` DATETIME(3) NULL,
    `returnedAt` DATETIME(3) NULL,
    `pickupLocation` TEXT NULL,
    `pickupResponsibleId` INTEGER NULL,
    `pickupContact` TEXT NULL,
    `returnLocation` TEXT NULL,
    `returnResponsibleId` INTEGER NULL,
    `returnContact` TEXT NULL,
    `finalQuantity` INTEGER NULL,
    `location` VARCHAR(191) NULL,
    `zoneId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockItem_stockGroupId_idx`(`stockGroupId`),
    INDEX `StockItem_stockGroupId_displayOrder_idx`(`stockGroupId`, `displayOrder`),
    INDEX `StockItem_zoneId_idx`(`zoneId`),
    INDEX `StockItem_markerId_idx`(`markerId`),
    INDEX `StockItem_pickupResponsibleId_idx`(`pickupResponsibleId`),
    INDEX `StockItem_returnResponsibleId_idx`(`returnResponsibleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockReservation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockItemId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `usage` TEXT NOT NULL,
    `quantityReserved` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('RESERVED', 'PICKED_UP', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'RESERVED',
    `location` VARCHAR(191) NULL,
    `zoneId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockReservation_stockItemId_idx`(`stockItemId`),
    INDEX `StockReservation_userId_idx`(`userId`),
    INDEX `StockReservation_zoneId_idx`(`zoneId`),
    INDEX `StockReservation_markerId_idx`(`markerId`),
    INDEX `StockReservation_stockItemId_startsAt_endsAt_idx`(`stockItemId`, `startsAt`, `endsAt`),
    INDEX `StockReservation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `StockShoppingList` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockShoppingList_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockShoppingListItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listId` INTEGER NOT NULL,
    `stockItemId` INTEGER NOT NULL,
    `purchased` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockShoppingListItem_listId_idx`(`listId`),
    INDEX `StockShoppingListItem_stockItemId_idx`(`stockItemId`),
    UNIQUE INDEX `StockShoppingListItem_listId_stockItemId_key`(`listId`, `stockItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockGroup` ADD CONSTRAINT `StockGroup_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_stockGroupId_fkey` FOREIGN KEY (`stockGroupId`) REFERENCES `StockGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_pickupResponsibleId_fkey` FOREIGN KEY (`pickupResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockItem` ADD CONSTRAINT `StockItem_returnResponsibleId_fkey` FOREIGN KEY (`returnResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTag` ADD CONSTRAINT `StockTag_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTagAssignment` ADD CONSTRAINT `StockTagAssignment_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTagAssignment` ADD CONSTRAINT `StockTagAssignment_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `StockTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockShoppingList` ADD CONSTRAINT `StockShoppingList_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockShoppingListItem` ADD CONSTRAINT `StockShoppingListItem_listId_fkey` FOREIGN KEY (`listId`) REFERENCES `StockShoppingList`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockShoppingListItem` ADD CONSTRAINT `StockShoppingListItem_stockItemId_fkey` FOREIGN KEY (`stockItemId`) REFERENCES `StockItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


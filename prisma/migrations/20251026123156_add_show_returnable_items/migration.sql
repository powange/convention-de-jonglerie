-- CreateTable
CREATE TABLE `ShowReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowReturnableItem_showId_idx`(`showId`),
    INDEX `ShowReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `ShowReturnableItem_showId_returnableItemId_key`(`showId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ShowReturnableItem` ADD CONSTRAINT `ShowReturnableItem_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowReturnableItem` ADD CONSTRAINT `ShowReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

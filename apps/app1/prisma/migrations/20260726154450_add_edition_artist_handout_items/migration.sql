-- CreateTable
CREATE TABLE `EditionArtistHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionArtistHandoutItem_editionId_idx`(`editionId`),
    INDEX `EditionArtistHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `EditionArtistHandoutItem_editionId_handoutItemId_key`(`editionId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionArtistHandoutItem` ADD CONSTRAINT `EditionArtistHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistHandoutItem` ADD CONSTRAINT `EditionArtistHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

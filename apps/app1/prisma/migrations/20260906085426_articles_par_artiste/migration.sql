-- CreateTable
CREATE TABLE `ArtistHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `artistId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ArtistHandoutItem_artistId_idx`(`artistId`),
    INDEX `ArtistHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `ArtistHandoutItem_artistId_handoutItemId_key`(`artistId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ArtistHandoutItem` ADD CONSTRAINT `ArtistHandoutItem_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistHandoutItem` ADD CONSTRAINT `ArtistHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

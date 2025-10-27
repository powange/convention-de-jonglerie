-- CreateTable
CREATE TABLE `ArtistMealSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `artistId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ArtistMealSelection_artistId_idx`(`artistId`),
    INDEX `ArtistMealSelection_mealId_idx`(`mealId`),
    UNIQUE INDEX `ArtistMealSelection_artistId_mealId_key`(`artistId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ArtistMealSelection` ADD CONSTRAINT `ArtistMealSelection_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistMealSelection` ADD CONSTRAINT `ArtistMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

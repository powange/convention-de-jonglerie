-- CreateTable
CREATE TABLE `EditionArtist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `arrivalDateTime` VARCHAR(191) NULL,
    `departureDateTime` VARCHAR(191) NULL,
    `dietaryPreference` ENUM('NONE', 'VEGETARIAN', 'VEGAN') NOT NULL DEFAULT 'NONE',
    `allergies` TEXT NULL,
    `allergySeverity` ENUM('LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionArtist_editionId_idx`(`editionId`),
    INDEX `EditionArtist_userId_idx`(`userId`),
    UNIQUE INDEX `EditionArtist_editionId_userId_key`(`editionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Show` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `duration` INTEGER NULL,
    `location` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Show_editionId_idx`(`editionId`),
    INDEX `Show_startDateTime_idx`(`startDateTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowArtist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `artistId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShowArtist_showId_idx`(`showId`),
    INDEX `ShowArtist_artistId_idx`(`artistId`),
    UNIQUE INDEX `ShowArtist_showId_artistId_key`(`showId`, `artistId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

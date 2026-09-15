-- CreateTable
CREATE TABLE `EditionVolunteerQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionVolunteerQuota_editionId_idx`(`editionId`),
    INDEX `EditionVolunteerQuota_quotaId_idx`(`quotaId`),
    INDEX `EditionVolunteerQuota_teamId_idx`(`teamId`),
    UNIQUE INDEX `EditionVolunteerQuota_editionId_quotaId_teamId_key`(`editionId`, `quotaId`, `teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionArtistQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `showId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionArtistQuota_editionId_idx`(`editionId`),
    INDEX `EditionArtistQuota_quotaId_idx`(`quotaId`),
    INDEX `EditionArtistQuota_showId_idx`(`showId`),
    UNIQUE INDEX `EditionArtistQuota_editionId_quotaId_showId_key`(`editionId`, `quotaId`, `showId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionVolunteerQuota` ADD CONSTRAINT `EditionVolunteerQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerQuota` ADD CONSTRAINT `EditionVolunteerQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerQuota` ADD CONSTRAINT `EditionVolunteerQuota_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistQuota` ADD CONSTRAINT `EditionArtistQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistQuota` ADD CONSTRAINT `EditionArtistQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtistQuota` ADD CONSTRAINT `EditionArtistQuota_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

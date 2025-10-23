-- CreateTable
CREATE TABLE `WorkshopFavorite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workshopId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkshopFavorite_workshopId_idx`(`workshopId`),
    INDEX `WorkshopFavorite_userId_idx`(`userId`),
    UNIQUE INDEX `WorkshopFavorite_workshopId_userId_key`(`workshopId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkshopFavorite` ADD CONSTRAINT `WorkshopFavorite_workshopId_fkey` FOREIGN KEY (`workshopId`) REFERENCES `Workshop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkshopFavorite` ADD CONSTRAINT `WorkshopFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `CarpoolPassenger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolOfferId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `addedById` INTEGER NOT NULL,

    INDEX `CarpoolPassenger_carpoolOfferId_fkey`(`carpoolOfferId`),
    INDEX `CarpoolPassenger_userId_fkey`(`userId`),
    UNIQUE INDEX `CarpoolPassenger_carpoolOfferId_userId_key`(`carpoolOfferId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CarpoolPassenger` ADD CONSTRAINT `CarpoolPassenger_carpoolOfferId_fkey` FOREIGN KEY (`carpoolOfferId`) REFERENCES `CarpoolOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolPassenger` ADD CONSTRAINT `CarpoolPassenger_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

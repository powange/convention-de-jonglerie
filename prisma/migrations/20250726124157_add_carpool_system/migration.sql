-- CreateTable
CREATE TABLE `CarpoolOffer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `departureDate` DATETIME(3) NOT NULL,
    `departureCity` VARCHAR(191) NOT NULL,
    `departureAddress` VARCHAR(191) NOT NULL,
    `availableSeats` INTEGER NOT NULL,
    `description` TEXT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `departureDate` DATETIME(3) NOT NULL,
    `departureCity` VARCHAR(191) NOT NULL,
    `seatsNeeded` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolOfferId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CarpoolOffer` ADD CONSTRAINT `CarpoolOffer_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolOffer` ADD CONSTRAINT `CarpoolOffer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequest` ADD CONSTRAINT `CarpoolRequest_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequest` ADD CONSTRAINT `CarpoolRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolComment` ADD CONSTRAINT `CarpoolComment_carpoolOfferId_fkey` FOREIGN KEY (`carpoolOfferId`) REFERENCES `CarpoolOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolComment` ADD CONSTRAINT `CarpoolComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `ConventionCollaborator` DROP FOREIGN KEY `ConventionCollaborator_addedById_fkey`;

-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_conventionId_fkey`;

-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_creatorId_fkey`;

-- CreateTable
CREATE TABLE `CarpoolBooking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolOfferId` INTEGER NOT NULL,
    `requestId` INTEGER NULL,
    `requesterId` INTEGER NOT NULL,
    `seats` INTEGER NOT NULL,
    `message` TEXT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CarpoolBooking_carpoolOfferId_fkey`(`carpoolOfferId`),
    INDEX `CarpoolBooking_requesterId_fkey`(`requesterId`),
    INDEX `CarpoolBooking_requestId_fkey`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_carpoolOfferId_fkey` FOREIGN KEY (`carpoolOfferId`) REFERENCES `CarpoolOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `CarpoolRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

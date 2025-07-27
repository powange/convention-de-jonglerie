-- CreateTable
CREATE TABLE `CarpoolRequestComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolRequestId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CarpoolRequestComment` ADD CONSTRAINT `CarpoolRequestComment_carpoolRequestId_fkey` FOREIGN KEY (`carpoolRequestId`) REFERENCES `CarpoolRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequestComment` ADD CONSTRAINT `CarpoolRequestComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersDescription` TEXT NULL,
    ADD COLUMN `volunteersOpen` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `volunteersUpdatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `phone` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `EditionVolunteerApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `motivation` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,
    `userSnapshotPhone` VARCHAR(191) NULL,

    INDEX `EditionVolunteerApplication_editionId_idx`(`editionId`),
    INDEX `EditionVolunteerApplication_status_idx`(`status`),
    UNIQUE INDEX `EditionVolunteerApplication_editionId_userId_key`(`editionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

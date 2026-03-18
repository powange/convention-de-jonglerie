-- CreateTable
CREATE TABLE `ShowPreset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `artistName` VARCHAR(191) NOT NULL,
    `artistBio` TEXT NULL,
    `portfolioUrl` VARCHAR(191) NULL,
    `videoUrl` VARCHAR(191) NULL,
    `socialLinks` TEXT NULL,
    `showTitle` VARCHAR(191) NOT NULL,
    `showDescription` TEXT NOT NULL,
    `showDuration` INTEGER NOT NULL,
    `showCategory` VARCHAR(191) NULL,
    `technicalNeeds` TEXT NULL,
    `additionalPerformersCount` INTEGER NOT NULL DEFAULT 0,
    `additionalPerformers` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowPreset_userId_idx`(`userId`),
    UNIQUE INDEX `ShowPreset_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ShowPreset` ADD CONSTRAINT `ShowPreset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

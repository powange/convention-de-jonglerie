-- CreateTable
CREATE TABLE `ApiErrorLog` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `stack` LONGTEXT NULL,
    `errorType` VARCHAR(191) NULL,
    `method` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `userAgent` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `headers` JSON NULL,
    `body` JSON NULL,
    `queryParams` JSON NULL,
    `userId` INTEGER NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedBy` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApiErrorLog_createdAt_idx`(`createdAt`),
    INDEX `ApiErrorLog_statusCode_idx`(`statusCode`),
    INDEX `ApiErrorLog_path_idx`(`path`),
    INDEX `ApiErrorLog_userId_idx`(`userId`),
    INDEX `ApiErrorLog_resolved_idx`(`resolved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApiErrorLog` ADD CONSTRAINT `ApiErrorLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

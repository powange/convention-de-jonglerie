-- DropForeignKey
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_creatorId_fkey`;

-- AlterTable
ALTER TABLE `Convention` ADD COLUMN `email` VARCHAR(191) NULL,
    MODIFY `authorId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Edition` MODIFY `creatorId` INTEGER NULL;

-- CreateTable
CREATE TABLE `ConventionClaimRequest` (
    `id` VARCHAR(191) NOT NULL,
    `conventionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConventionClaimRequest_code_key`(`code`),
    INDEX `ConventionClaimRequest_conventionId_idx`(`conventionId`),
    INDEX `ConventionClaimRequest_userId_idx`(`userId`),
    INDEX `ConventionClaimRequest_code_idx`(`code`),
    INDEX `ConventionClaimRequest_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `ConventionClaimRequest_conventionId_userId_key`(`conventionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionClaimRequest` ADD CONSTRAINT `ConventionClaimRequest_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionClaimRequest` ADD CONSTRAINT `ConventionClaimRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

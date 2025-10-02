-- CreateTable
CREATE TABLE `HelloAssoTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `helloAssoTierId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` INTEGER NOT NULL,
    `minAmount` INTEGER NULL,
    `maxAmount` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HelloAssoTier_externalTicketingId_idx`(`externalTicketingId`),
    UNIQUE INDEX `HelloAssoTier_externalTicketingId_helloAssoTierId_key`(`externalTicketingId`, `helloAssoTierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HelloAssoOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `helloAssoOptionId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `choices` JSON NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HelloAssoOption_externalTicketingId_idx`(`externalTicketingId`),
    UNIQUE INDEX `HelloAssoOption_externalTicketingId_helloAssoOptionId_key`(`externalTicketingId`, `helloAssoOptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HelloAssoTier` ADD CONSTRAINT `HelloAssoTier_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelloAssoOption` ADD CONSTRAINT `HelloAssoOption_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

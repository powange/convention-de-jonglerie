-- AlterTable
ALTER TABLE `ExternalTicketing` MODIFY `provider` ENUM('HELLOASSO', 'INFOMANIAK', 'BILLETWEB', 'WEEZEVENT', 'OTHER') NOT NULL;

-- CreateTable
CREATE TABLE `InfomaniakConfig` (
    `id` VARCHAR(191) NOT NULL,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT '2',
    `eventId` INTEGER NULL,
    `eventName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InfomaniakConfig_externalTicketingId_key`(`externalTicketingId`),
    INDEX `InfomaniakConfig_externalTicketingId_idx`(`externalTicketingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InfomaniakConfig` ADD CONSTRAINT `InfomaniakConfig_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

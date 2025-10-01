-- CreateTable
CREATE TABLE `ExternalTicketing` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `provider` ENUM('HELLOASSO', 'BILLETWEB', 'WEEZEVENT', 'OTHER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ERROR') NOT NULL DEFAULT 'ACTIVE',
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExternalTicketing_editionId_key`(`editionId`),
    INDEX `ExternalTicketing_editionId_idx`(`editionId`),
    INDEX `ExternalTicketing_provider_idx`(`provider`),
    INDEX `ExternalTicketing_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HelloAssoConfig` (
    `id` VARCHAR(191) NOT NULL,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` VARCHAR(191) NOT NULL,
    `organizationSlug` VARCHAR(191) NOT NULL,
    `formType` VARCHAR(191) NOT NULL,
    `formSlug` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HelloAssoConfig_externalTicketingId_key`(`externalTicketingId`),
    INDEX `HelloAssoConfig_externalTicketingId_idx`(`externalTicketingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExternalTicketing` ADD CONSTRAINT `ExternalTicketing_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelloAssoConfig` ADD CONSTRAINT `HelloAssoConfig_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

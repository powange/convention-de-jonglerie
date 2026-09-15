-- CreateTable
CREATE TABLE `EditionOrganizerQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `organizerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionOrganizerQuota_editionId_idx`(`editionId`),
    INDEX `EditionOrganizerQuota_quotaId_idx`(`quotaId`),
    INDEX `EditionOrganizerQuota_organizerId_idx`(`organizerId`),
    UNIQUE INDEX `EditionOrganizerQuota_editionId_quotaId_organizerId_key`(`editionId`, `quotaId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionOrganizerQuota` ADD CONSTRAINT `EditionOrganizerQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerQuota` ADD CONSTRAINT `EditionOrganizerQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerQuota` ADD CONSTRAINT `EditionOrganizerQuota_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

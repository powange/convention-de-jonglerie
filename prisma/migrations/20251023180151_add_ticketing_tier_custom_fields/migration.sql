-- CreateTable
CREATE TABLE `TicketingTierCustomField` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `helloAssoCustomFieldId` INTEGER NOT NULL,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `label` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `values` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTierCustomField_externalTicketingId_idx`(`externalTicketingId`),
    UNIQUE INDEX `TicketingTierCustomField_externalTicketingId_helloAssoCustom_key`(`externalTicketingId`, `helloAssoCustomFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldAssociation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `customFieldId` INTEGER NOT NULL,

    INDEX `TicketingTierCustomFieldAssociation_tierId_idx`(`tierId`),
    INDEX `TicketingTierCustomFieldAssociation_customFieldId_idx`(`customFieldId`),
    UNIQUE INDEX `TicketingTierCustomFieldAssociation_tierId_customFieldId_key`(`tierId`, `customFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomField` ADD CONSTRAINT `TicketingTierCustomField_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldAssociation` ADD CONSTRAINT `TicketingTierCustomFieldAssociation_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldAssociation` ADD CONSTRAINT `TicketingTierCustomFieldAssociation_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

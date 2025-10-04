-- CreateTable
CREATE TABLE `TierQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,

    INDEX `TierQuota_tierId_idx`(`tierId`),
    INDEX `TierQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TierQuota_tierId_quotaId_key`(`tierId`, `quotaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TierReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,

    INDEX `TierReturnableItem_tierId_idx`(`tierId`),
    INDEX `TierReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `TierReturnableItem_tierId_returnableItemId_key`(`tierId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TierQuota` ADD CONSTRAINT `TierQuota_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `HelloAssoTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TierQuota` ADD CONSTRAINT `TierQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TierReturnableItem` ADD CONSTRAINT `TierReturnableItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `HelloAssoTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TierReturnableItem` ADD CONSTRAINT `TierReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `ReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

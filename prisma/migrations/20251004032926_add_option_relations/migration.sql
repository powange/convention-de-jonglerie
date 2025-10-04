-- CreateTable
CREATE TABLE `OptionQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,

    INDEX `OptionQuota_optionId_idx`(`optionId`),
    INDEX `OptionQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `OptionQuota_optionId_quotaId_key`(`optionId`, `quotaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OptionReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,

    INDEX `OptionReturnableItem_optionId_idx`(`optionId`),
    INDEX `OptionReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `OptionReturnableItem_optionId_returnableItemId_key`(`optionId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OptionQuota` ADD CONSTRAINT `OptionQuota_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `HelloAssoOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptionQuota` ADD CONSTRAINT `OptionQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptionReturnableItem` ADD CONSTRAINT `OptionReturnableItem_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `HelloAssoOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OptionReturnableItem` ADD CONSTRAINT `OptionReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `ReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

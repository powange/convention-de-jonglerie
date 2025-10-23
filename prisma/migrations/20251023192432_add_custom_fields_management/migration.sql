/*
  Warnings:

  - Added the required column `editionId` to the `TicketingTierCustomField` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TicketingTierCustomField` ADD COLUMN `editionId` INTEGER NOT NULL,
    MODIFY `helloAssoCustomFieldId` INTEGER NULL,
    MODIFY `externalTicketingId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customFieldId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `choiceValue` VARCHAR(191) NULL,

    INDEX `TicketingTierCustomFieldQuota_customFieldId_idx`(`customFieldId`),
    INDEX `TicketingTierCustomFieldQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TicketingTierCustomFieldQuota_customFieldId_quotaId_choiceVa_key`(`customFieldId`, `quotaId`, `choiceValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customFieldId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `choiceValue` VARCHAR(191) NULL,

    INDEX `TicketingTierCustomFieldReturnableItem_customFieldId_idx`(`customFieldId`),
    INDEX `TicketingTierCustomFieldReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `TicketingTierCustomFieldReturnableItem_customFieldId_returna_key`(`customFieldId`, `returnableItemId`, `choiceValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `TicketingTierCustomField_editionId_idx` ON `TicketingTierCustomField`(`editionId`);

-- AddForeignKey
ALTER TABLE `TicketingTierCustomField` ADD CONSTRAINT `TicketingTierCustomField_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldQuota` ADD CONSTRAINT `TicketingTierCustomFieldQuota_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldQuota` ADD CONSTRAINT `TicketingTierCustomFieldQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldReturnableItem` ADD CONSTRAINT `TicketingTierCustomFieldReturnableItem_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldReturnableItem` ADD CONSTRAINT `TicketingTierCustomFieldReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

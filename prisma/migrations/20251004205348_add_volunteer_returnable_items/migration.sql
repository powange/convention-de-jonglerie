-- CreateTable
CREATE TABLE `EditionVolunteerReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionVolunteerReturnableItem_editionId_idx`(`editionId`),
    INDEX `EditionVolunteerReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `EditionVolunteerReturnableItem_editionId_returnableItemId_key`(`editionId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `ReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `EditionOrganizerReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `organizerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionOrganizerReturnableItem_editionId_idx`(`editionId`),
    INDEX `EditionOrganizerReturnableItem_returnableItemId_idx`(`returnableItemId`),
    INDEX `EditionOrganizerReturnableItem_organizerId_idx`(`organizerId`),
    UNIQUE INDEX `EditionOrganizerReturnableItem_editionId_returnableItemId_or_key`(`editionId`, `returnableItemId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionOrganizerReturnableItem` ADD CONSTRAINT `EditionOrganizerReturnableItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerReturnableItem` ADD CONSTRAINT `EditionOrganizerReturnableItem_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

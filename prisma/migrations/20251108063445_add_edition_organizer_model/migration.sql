-- CreateTable
CREATE TABLE `EditionOrganizer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `organizerId` INTEGER NOT NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionOrganizer_editionId_idx`(`editionId`),
    INDEX `EditionOrganizer_organizerId_idx`(`organizerId`),
    INDEX `EditionOrganizer_entryValidatedBy_idx`(`entryValidatedBy`),
    UNIQUE INDEX `EditionOrganizer_editionId_organizerId_key`(`editionId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionOrganizer` ADD CONSTRAINT `EditionOrganizer_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizer` ADD CONSTRAINT `EditionOrganizer_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `ConventionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

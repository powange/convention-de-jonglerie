-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `cashFloatCount` INTEGER NULL,
    ADD COLUMN `cashFloatCountedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `TreasuryCashFloat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `lentById` INTEGER NULL,
    `lentByName` VARCHAR(150) NULL,
    `operationDate` DATE NULL,
    `restitutedAt` DATETIME(3) NULL,
    `note` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreasuryCashFloat_editionId_idx`(`editionId`),
    INDEX `TreasuryCashFloat_lentById_idx`(`lentById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TreasuryCashFloat` ADD CONSTRAINT `TreasuryCashFloat_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryCashFloat` ADD CONSTRAINT `TreasuryCashFloat_lentById_fkey` FOREIGN KEY (`lentById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

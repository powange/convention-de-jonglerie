-- AlterTable
ALTER TABLE `ConventionOrganizer` ADD COLUMN `canManageTreasury` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `treasuryEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionOrganizerPermission` ADD COLUMN `canManageTreasury` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `TreasuryCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreasuryCode_conventionId_idx`(`conventionId`),
    UNIQUE INDEX `TreasuryCode_conventionId_code_key`(`conventionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreasuryEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `kind` ENUM('EXPENSE', 'INCOME') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `amount` INTEGER NOT NULL,
    `codeId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreasuryEntry_editionId_idx`(`editionId`),
    INDEX `TreasuryEntry_codeId_idx`(`codeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreasurySourceCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `source` ENUM('ARTIST_PAYMENT', 'ARTIST_REIMBURSEMENT', 'ARTIST_CONSUMABLES', 'TICKETING_ORDERS') NOT NULL,
    `codeId` INTEGER NOT NULL,

    INDEX `TreasurySourceCode_codeId_idx`(`codeId`),
    UNIQUE INDEX `TreasurySourceCode_editionId_source_key`(`editionId`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TreasuryCode` ADD CONSTRAINT `TreasuryCode_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntry` ADD CONSTRAINT `TreasuryEntry_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntry` ADD CONSTRAINT `TreasuryEntry_codeId_fkey` FOREIGN KEY (`codeId`) REFERENCES `TreasuryCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasurySourceCode` ADD CONSTRAINT `TreasurySourceCode_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasurySourceCode` ADD CONSTRAINT `TreasurySourceCode_codeId_fkey` FOREIGN KEY (`codeId`) REFERENCES `TreasuryCode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


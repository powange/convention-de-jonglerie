-- Trésorerie (lot 8 de docs/flowvent-modules.md) : les modèles d'app1, rattachés à l'événement.
-- Purement additive : aucune donnée existante n'est touchée.

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `cashFloatCount` INTEGER NULL,
    ADD COLUMN `cashFloatCountedAt` DATETIME(3) NULL;

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
CREATE TABLE `TreasuryEntryTier` (
    `entryId` INTEGER NOT NULL,
    `tierId` INTEGER NOT NULL,

    INDEX `TreasuryEntryTier_entryId_fkey`(`entryId`),
    UNIQUE INDEX `TreasuryEntryTier_tierId_key`(`tierId`),
    PRIMARY KEY (`entryId`, `tierId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreasuryPayee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `iban` VARCHAR(34) NULL,
    `bic` VARCHAR(11) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreasuryPayee_editionId_idx`(`editionId`),
    UNIQUE INDEX `TreasuryPayee_editionId_label_key`(`editionId`, `label`),
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
    `imageUrl` VARCHAR(191) NULL,
    `isForecast` BOOLEAN NOT NULL DEFAULT false,
    `advancedById` INTEGER NULL,
    `advancedByName` VARCHAR(150) NULL,
    `reimbursed` BOOLEAN NOT NULL DEFAULT false,
    `reimbursedAt` DATETIME(3) NULL,
    `payeeId` INTEGER NULL,
    `disbursed` BOOLEAN NOT NULL DEFAULT false,
    `disbursedAt` DATETIME(3) NULL,
    `operationDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreasuryEntry_editionId_idx`(`editionId`),
    INDEX `TreasuryEntry_codeId_idx`(`codeId`),
    INDEX `TreasuryEntry_advancedById_idx`(`advancedById`),
    INDEX `TreasuryEntry_editionId_payeeId_disbursed_idx`(`editionId`, `payeeId`, `disbursed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreasurySourceCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `source` ENUM('ARTIST_PAYMENT', 'ARTIST_REIMBURSEMENT', 'ARTIST_CONSUMABLES', 'TICKETING_PARTICIPANTS', 'TICKETING_DONATIONS', 'TICKETING_OTHER') NOT NULL,
    `codeId` INTEGER NOT NULL,

    INDEX `TreasurySourceCode_codeId_idx`(`codeId`),
    UNIQUE INDEX `TreasurySourceCode_editionId_source_key`(`editionId`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
ALTER TABLE `TreasuryCode` ADD CONSTRAINT `TreasuryCode_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntryTier` ADD CONSTRAINT `TreasuryEntryTier_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `TreasuryEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntryTier` ADD CONSTRAINT `TreasuryEntryTier_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryPayee` ADD CONSTRAINT `TreasuryPayee_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntry` ADD CONSTRAINT `TreasuryEntry_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntry` ADD CONSTRAINT `TreasuryEntry_codeId_fkey` FOREIGN KEY (`codeId`) REFERENCES `TreasuryCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntry` ADD CONSTRAINT `TreasuryEntry_advancedById_fkey` FOREIGN KEY (`advancedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntry` ADD CONSTRAINT `TreasuryEntry_payeeId_fkey` FOREIGN KEY (`payeeId`) REFERENCES `TreasuryPayee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasurySourceCode` ADD CONSTRAINT `TreasurySourceCode_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasurySourceCode` ADD CONSTRAINT `TreasurySourceCode_codeId_fkey` FOREIGN KEY (`codeId`) REFERENCES `TreasuryCode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryCashFloat` ADD CONSTRAINT `TreasuryCashFloat_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryCashFloat` ADD CONSTRAINT `TreasuryCashFloat_lentById_fkey` FOREIGN KEY (`lentById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


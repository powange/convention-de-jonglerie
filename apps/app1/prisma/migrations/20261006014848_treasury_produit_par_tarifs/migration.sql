-- CreateTable
CREATE TABLE `TreasuryEntryTier` (
    `entryId` INTEGER NOT NULL,
    `tierId` INTEGER NOT NULL,

    INDEX `TreasuryEntryTier_entryId_fkey`(`entryId`),
    UNIQUE INDEX `TreasuryEntryTier_tierId_key`(`tierId`),
    PRIMARY KEY (`entryId`, `tierId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TreasuryEntryTier` ADD CONSTRAINT `TreasuryEntryTier_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `TreasuryEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryEntryTier` ADD CONSTRAINT `TreasuryEntryTier_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

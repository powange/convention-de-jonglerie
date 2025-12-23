-- CreateTable
CREATE TABLE `TicketingTierOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,

    INDEX `TicketingTierOption_tierId_idx`(`tierId`),
    INDEX `TicketingTierOption_optionId_idx`(`optionId`),
    UNIQUE INDEX `TicketingTierOption_tierId_optionId_key`(`tierId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketingTierOption` ADD CONSTRAINT `TicketingTierOption_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierOption` ADD CONSTRAINT `TicketingTierOption_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

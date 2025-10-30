-- CreateTable
CREATE TABLE `TicketingTierMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTierMeal_tierId_idx`(`tierId`),
    INDEX `TicketingTierMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingTierMeal_tierId_mealId_key`(`tierId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketingTierMeal` ADD CONSTRAINT `TicketingTierMeal_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierMeal` ADD CONSTRAINT `TicketingTierMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

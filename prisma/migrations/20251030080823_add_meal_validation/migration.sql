-- AlterTable
ALTER TABLE `ArtistMealSelection` ADD COLUMN `consumedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `VolunteerMealSelection` ADD COLUMN `consumedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `TicketingOrderItemMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderItemId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItemMeal_orderItemId_idx`(`orderItemId`),
    INDEX `TicketingOrderItemMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingOrderItemMeal_orderItemId_mealId_key`(`orderItemId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemMeal` ADD CONSTRAINT `TicketingOrderItemMeal_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `TicketingOrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemMeal` ADD CONSTRAINT `TicketingOrderItemMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

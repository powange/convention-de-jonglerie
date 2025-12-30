-- CreateTable
CREATE TABLE `TicketingOptionMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOptionMeal_optionId_idx`(`optionId`),
    INDEX `TicketingOptionMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingOptionMeal_optionId_mealId_key`(`optionId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketingOptionMeal` ADD CONSTRAINT `TicketingOptionMeal_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionMeal` ADD CONSTRAINT `TicketingOptionMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

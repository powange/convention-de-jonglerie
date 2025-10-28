-- CreateTable
CREATE TABLE `VolunteerMealReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mealId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerMealReturnableItem_mealId_idx`(`mealId`),
    INDEX `VolunteerMealReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `VolunteerMealReturnableItem_mealId_returnableItemId_key`(`mealId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VolunteerMealReturnableItem` ADD CONSTRAINT `VolunteerMealReturnableItem_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealReturnableItem` ADD CONSTRAINT `VolunteerMealReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

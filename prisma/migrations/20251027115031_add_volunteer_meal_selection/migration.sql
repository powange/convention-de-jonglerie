-- CreateTable
CREATE TABLE `VolunteerMealSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `volunteerId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerMealSelection_volunteerId_idx`(`volunteerId`),
    INDEX `VolunteerMealSelection_mealId_idx`(`mealId`),
    UNIQUE INDEX `VolunteerMealSelection_volunteerId_mealId_key`(`volunteerId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VolunteerMealSelection` ADD CONSTRAINT `VolunteerMealSelection_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `EditionVolunteerApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealSelection` ADD CONSTRAINT `VolunteerMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

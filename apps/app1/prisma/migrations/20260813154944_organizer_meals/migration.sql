-- AlterTable
ALTER TABLE `EditionOrganizer` ADD COLUMN `allergies` TEXT NULL,
    ADD COLUMN `allergySeverity` ENUM('LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL') NULL,
    ADD COLUMN `dietaryPreference` ENUM('NONE', 'VEGETARIAN', 'VEGAN') NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE `OrganizerMealSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionOrganizerId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrganizerMealSelection_editionOrganizerId_idx`(`editionOrganizerId`),
    INDEX `OrganizerMealSelection_mealId_idx`(`mealId`),
    UNIQUE INDEX `OrganizerMealSelection_editionOrganizerId_mealId_key`(`editionOrganizerId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrganizerMealSelection` ADD CONSTRAINT `OrganizerMealSelection_editionOrganizerId_fkey` FOREIGN KEY (`editionOrganizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerMealSelection` ADD CONSTRAINT `OrganizerMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

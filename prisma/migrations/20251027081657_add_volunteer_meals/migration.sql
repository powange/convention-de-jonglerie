-- CreateTable
CREATE TABLE `VolunteerMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `phase` ENUM('SETUP', 'EVENT', 'TEARDOWN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerMeal_editionId_idx`(`editionId`),
    INDEX `VolunteerMeal_date_idx`(`date`),
    UNIQUE INDEX `VolunteerMeal_editionId_date_mealType_key`(`editionId`, `date`, `mealType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VolunteerMeal` ADD CONSTRAINT `VolunteerMeal_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

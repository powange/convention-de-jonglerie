-- AlterTable
ALTER TABLE `User` ADD COLUMN `allergies` TEXT NULL,
    ADD COLUMN `allergySeverity` ENUM('LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL') NULL,
    ADD COLUMN `dietaryPreference` ENUM('NONE', 'VEGETARIAN', 'VEGAN') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `emergencyContactName` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL;

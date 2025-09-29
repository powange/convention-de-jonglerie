-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `allergySeverity` ENUM('LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL') NULL AFTER `allergies`;
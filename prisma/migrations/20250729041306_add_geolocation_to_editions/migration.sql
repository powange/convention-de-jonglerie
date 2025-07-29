-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `latitude` DOUBLE NULL AFTER `region`;
ALTER TABLE `Edition` ADD COLUMN `longitude` DOUBLE NULL AFTER `latitude`;

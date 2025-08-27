-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `volunteersExternalUrl` VARCHAR(191) NULL,
    ADD COLUMN `volunteersMode` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL';

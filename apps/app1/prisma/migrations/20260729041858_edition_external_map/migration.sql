-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `externalMapProvider` VARCHAR(191) NULL,
    ADD COLUMN `externalMapRef` VARCHAR(191) NULL;

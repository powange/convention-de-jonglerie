-- AlterTable
ALTER TABLE `User` ADD COLUMN `pendingEmail` VARCHAR(191) NULL,
    ADD COLUMN `pendingEmailCode` VARCHAR(191) NULL,
    ADD COLUMN `pendingEmailExpiry` DATETIME(3) NULL;

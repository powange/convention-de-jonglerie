-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerificationCode` VARCHAR(191) NULL,
    ADD COLUMN `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `verificationCodeExpiry` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `authProvider` VARCHAR(191) NOT NULL DEFAULT 'email';

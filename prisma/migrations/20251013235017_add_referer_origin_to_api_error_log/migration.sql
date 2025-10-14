-- AlterTable
ALTER TABLE `ApiErrorLog` ADD COLUMN `origin` VARCHAR(191) NULL,
    ADD COLUMN `referer` TEXT NULL;

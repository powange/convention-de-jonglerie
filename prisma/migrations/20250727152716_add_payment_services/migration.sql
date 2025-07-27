-- AlterTable
ALTER TABLE `Convention` ADD COLUMN `hasAfjTokenPayment` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasCreditCardPayment` BOOLEAN NOT NULL DEFAULT false;

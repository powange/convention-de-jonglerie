-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `ticketingPaymentCard` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `ticketingPaymentCash` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `ticketingPaymentCheck` BOOLEAN NOT NULL DEFAULT true;

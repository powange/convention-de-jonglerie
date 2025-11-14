-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `ticketingAllowAnonymousOrders` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ticketingAllowOnsiteRegistration` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Event` ADD COLUMN `ticketingAllowAnonymousOrders` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ticketingAllowOnsiteRegistration` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `ticketingHandoutItemsEnabled` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `ticketingPaymentCard` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `ticketingPaymentCash` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `ticketingPaymentCheck` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `ticketingSumupEnabled` BOOLEAN NOT NULL DEFAULT false;


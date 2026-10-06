-- AlterTable
ALTER TABLE `TicketingOrderItem` ADD COLUMN `discountPaidBack` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `discountPaidBackAt` DATETIME(3) NULL,
    ADD COLUMN `discountPaidBackById` INTEGER NULL;

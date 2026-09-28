-- AlterTable
ALTER TABLE `TicketingOrderItem` ADD COLUMN `canceledAt` DATETIME(3) NULL,
    ADD COLUMN `canceledById` INTEGER NULL,
    ADD COLUMN `refunded` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `refundedAt` DATETIME(3) NULL,
    ADD COLUMN `refundedById` INTEGER NULL;

-- AlterTable
ALTER TABLE `TicketingOrderItem` ADD COLUMN `discountAmount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `discountedAt` DATETIME(3) NULL,
    ADD COLUMN `discountedById` INTEGER NULL;

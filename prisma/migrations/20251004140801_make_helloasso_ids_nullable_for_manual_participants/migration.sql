-- DropIndex
DROP INDEX `HelloAssoOrderItem_orderId_helloAssoItemId_key` ON `HelloAssoOrderItem`;

-- AlterTable
ALTER TABLE `HelloAssoOrder` MODIFY `externalTicketingId` VARCHAR(191) NULL,
    MODIFY `helloAssoOrderId` INTEGER NULL;

-- AlterTable
ALTER TABLE `HelloAssoOrderItem` MODIFY `helloAssoItemId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `HelloAssoOrderItem_helloAssoItemId_idx` ON `HelloAssoOrderItem`(`helloAssoItemId`);

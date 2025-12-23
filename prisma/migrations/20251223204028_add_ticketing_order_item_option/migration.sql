-- CreateTable
CREATE TABLE `TicketingOrderItemOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderItemId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `customFields` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItemOption_orderItemId_idx`(`orderItemId`),
    INDEX `TicketingOrderItemOption_optionId_idx`(`optionId`),
    UNIQUE INDEX `TicketingOrderItemOption_orderItemId_optionId_key`(`orderItemId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemOption` ADD CONSTRAINT `TicketingOrderItemOption_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `TicketingOrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemOption` ADD CONSTRAINT `TicketingOrderItemOption_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

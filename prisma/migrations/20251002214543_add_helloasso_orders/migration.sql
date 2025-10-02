-- CreateTable
CREATE TABLE `HelloAssoOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `helloAssoOrderId` INTEGER NOT NULL,
    `payerFirstName` VARCHAR(191) NOT NULL,
    `payerLastName` VARCHAR(191) NOT NULL,
    `payerEmail` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HelloAssoOrder_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `HelloAssoOrder_payerEmail_idx`(`payerEmail`),
    UNIQUE INDEX `HelloAssoOrder_externalTicketingId_helloAssoOrderId_key`(`externalTicketingId`, `helloAssoOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HelloAssoOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `helloAssoItemId` INTEGER NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `qrCode` VARCHAR(191) NULL,
    `customFields` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HelloAssoOrderItem_orderId_idx`(`orderId`),
    INDEX `HelloAssoOrderItem_email_idx`(`email`),
    INDEX `HelloAssoOrderItem_qrCode_idx`(`qrCode`),
    UNIQUE INDEX `HelloAssoOrderItem_orderId_helloAssoItemId_key`(`orderId`, `helloAssoItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HelloAssoOrder` ADD CONSTRAINT `HelloAssoOrder_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelloAssoOrderItem` ADD CONSTRAINT `HelloAssoOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `HelloAssoOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

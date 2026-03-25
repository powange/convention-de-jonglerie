-- CreateTable
CREATE TABLE `ProjectExpense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('DOMAIN', 'HOSTING', 'HARDWARE', 'ELECTRICITY', 'SOFTWARE', 'SERVICE', 'OTHER') NOT NULL,
    `icon` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProjectExpense_isActive_idx`(`isActive`),
    INDEX `ProjectExpense_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectExpenseRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expenseId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `period` ENUM('MONTHLY', 'YEARLY', 'ONE_TIME') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_project_expense_rate_expense`(`expenseId`),
    INDEX `ProjectExpenseRate_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectExpenseRate` ADD CONSTRAINT `ProjectExpenseRate_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `ProjectExpense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

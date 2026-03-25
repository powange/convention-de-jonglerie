-- CreateTable
CREATE TABLE `StripeConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicKey` TEXT NOT NULL,
    `secretKey` TEXT NOT NULL,
    `webhookSecret` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoffeeDonation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stripeSessionId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `totalCents` INTEGER NOT NULL,
    `feeCents` INTEGER NULL,
    `netCents` INTEGER NULL,
    `email` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CoffeeDonation_stripeSessionId_key`(`stripeSessionId`),
    INDEX `CoffeeDonation_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

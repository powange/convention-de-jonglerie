-- Codes promo de Flowvent (shared/codes-promo.ts) : deux tables créées, trois colonnes ajoutées à
-- Subscription. Additive : aucune donnée supprimée.
-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `advantageEndsAt` DATETIME(3) NULL,
    ADD COLUMN `amountPaid` INTEGER NULL,
    ADD COLUMN `promoCodeId` INTEGER NULL;

-- CreateTable
CREATE TABLE `PromoCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(64) NOT NULL,
    `label` VARCHAR(191) NULL,
    `advantage` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `formules` JSON NULL,
    `periods` JSON NULL,
    `duration` VARCHAR(191) NOT NULL,
    `durationMonths` INTEGER NULL,
    `startsAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `maxRedemptions` INTEGER NULL,
    `reservedEmail` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PromoCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoCodeRedemption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `promoCodeId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `formule` VARCHAR(191) NOT NULL,
    `plan` VARCHAR(191) NOT NULL,
    `amountPaid` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PromoCodeRedemption_userId_idx`(`userId`),
    UNIQUE INDEX `PromoCodeRedemption_promoCodeId_userId_key`(`promoCodeId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Subscription_promoCodeId_idx` ON `Subscription`(`promoCodeId`);

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_promoCodeId_fkey` FOREIGN KEY (`promoCodeId`) REFERENCES `PromoCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoCodeRedemption` ADD CONSTRAINT `PromoCodeRedemption_promoCodeId_fkey` FOREIGN KEY (`promoCodeId`) REFERENCES `PromoCode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoCodeRedemption` ADD CONSTRAINT `PromoCodeRedemption_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


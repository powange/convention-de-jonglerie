-- AlterTable
ALTER TABLE `HelloAssoOrderItem` ADD COLUMN `tierId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `HelloAssoOrderItem_tierId_idx` ON `HelloAssoOrderItem`(`tierId`);

-- AddForeignKey
ALTER TABLE `HelloAssoOrderItem` ADD CONSTRAINT `HelloAssoOrderItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `HelloAssoTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

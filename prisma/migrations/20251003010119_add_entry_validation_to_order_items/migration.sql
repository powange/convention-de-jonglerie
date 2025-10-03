-- AlterTable
ALTER TABLE `HelloAssoOrderItem` ADD COLUMN `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `entryValidatedAt` DATETIME(3) NULL,
    ADD COLUMN `entryValidatedBy` INTEGER NULL;

-- CreateIndex
CREATE INDEX `HelloAssoOrderItem_entryValidated_idx` ON `HelloAssoOrderItem`(`entryValidated`);
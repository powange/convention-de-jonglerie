/*
  Warnings:

  - A unique constraint covering the columns `[qrCodeToken]` on the table `EditionOrganizer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `EditionOrganizer` ADD COLUMN `qrCodeToken` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `EditionOrganizer_qrCodeToken_key` ON `EditionOrganizer`(`qrCodeToken`);

-- CreateIndex
CREATE INDEX `EditionOrganizer_qrCodeToken_idx` ON `EditionOrganizer`(`qrCodeToken`);

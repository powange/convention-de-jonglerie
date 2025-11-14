/*
  Warnings:

  - A unique constraint covering the columns `[qrCodeToken]` on the table `EditionArtist` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `qrCodeToken` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `EditionArtist_qrCodeToken_key` ON `EditionArtist`(`qrCodeToken`);

-- CreateIndex
CREATE INDEX `EditionArtist_qrCodeToken_idx` ON `EditionArtist`(`qrCodeToken`);

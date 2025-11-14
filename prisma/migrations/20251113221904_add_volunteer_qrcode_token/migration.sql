/*
  Warnings:

  - A unique constraint covering the columns `[qrCodeToken]` on the table `EditionVolunteerApplication` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `qrCodeToken` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `EditionVolunteerApplication_qrCodeToken_key` ON `EditionVolunteerApplication`(`qrCodeToken`);

-- CreateIndex
CREATE INDEX `EditionVolunteerApplication_qrCodeToken_idx` ON `EditionVolunteerApplication`(`qrCodeToken`);

/*
  Warnings:

  - You are about to drop the column `reimbursement` on the `EditionArtist` table. All the data in the column will be lost.
  - You are about to drop the column `reimbursementPaid` on the `EditionArtist` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `EditionArtist` DROP COLUMN `reimbursement`,
    DROP COLUMN `reimbursementPaid`,
    ADD COLUMN `reimbursementActual` DECIMAL(10, 2) NULL,
    ADD COLUMN `reimbursementActualPaid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reimbursementMax` DECIMAL(10, 2) NULL;

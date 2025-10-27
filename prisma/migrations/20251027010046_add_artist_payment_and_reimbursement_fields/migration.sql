-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `payment` DECIMAL(10, 2) NULL,
    ADD COLUMN `paymentPaid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reimbursement` DECIMAL(10, 2) NULL,
    ADD COLUMN `reimbursementPaid` BOOLEAN NOT NULL DEFAULT false;

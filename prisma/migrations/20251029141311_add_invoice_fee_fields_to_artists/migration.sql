-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `feeProvided` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `feeRequested` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `invoiceProvided` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `invoiceRequested` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `consumablesActual` DECIMAL(10, 2) NULL,
    ADD COLUMN `consumablesActualPaid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `consumablesMax` DECIMAL(10, 2) NULL;

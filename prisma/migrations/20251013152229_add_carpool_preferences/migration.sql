-- AlterTable
ALTER TABLE `CarpoolOffer` ADD COLUMN `musicAllowed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `petsAllowed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `smokingAllowed` BOOLEAN NOT NULL DEFAULT false;

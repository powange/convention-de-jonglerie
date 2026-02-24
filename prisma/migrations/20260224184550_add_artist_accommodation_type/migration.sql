-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `accommodationType` ENUM('TENT', 'VEHICLE', 'HOSTED', 'OTHER') NULL,
    ADD COLUMN `accommodationTypeOther` TEXT NULL;

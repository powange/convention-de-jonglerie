-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `accommodationAutonomous` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `accommodationProposal` TEXT NULL;

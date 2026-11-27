-- Page publique de l'événement (/events/<publicId>) : adresse postale, affiche, liens, et le choix
-- de l'organisateur de la rendre visible de tous (fermée par défaut). Rien n'est détruit.
-- AlterTable
ALTER TABLE `Event` ADD COLUMN `addressLine1` VARCHAR(191) NULL,
    ADD COLUMN `addressLine2` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NULL,
    ADD COLUMN `facebookUrl` VARCHAR(500) NULL,
    ADD COLUMN `imageUrl` VARCHAR(191) NULL,
    ADD COLUMN `instagramUrl` VARCHAR(500) NULL,
    ADD COLUMN `officialWebsiteUrl` VARCHAR(500) NULL,
    ADD COLUMN `pagePublique` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `postalCode` VARCHAR(20) NULL,
    ADD COLUMN `ticketingUrl` VARCHAR(500) NULL;


-- Contact public et coordonnées GPS du lieu (page publique de l'événement). Ajouts seulement.
-- AlterTable
ALTER TABLE `Event` ADD COLUMN `contactEmail` VARCHAR(191) NULL,
    ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL;


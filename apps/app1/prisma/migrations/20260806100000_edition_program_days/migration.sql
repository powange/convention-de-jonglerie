-- Programme d'une édition, jour par jour.
--
-- Le champ `Edition.program` est conservé tel quel : il porte ce qui ne se rattache à aucune date
-- — plan d'accès, tarifs, principes de vie commune — et neuf éditions y ont déjà du contenu
-- substantiel. Rien n'est déplacé : répartir d'autorité un texte couvrant quatre jours
-- l'étiquetterait arbitrairement sur l'un d'eux.
--
-- Aucune contrainte ne lie `date` aux dates de l'édition. Celles-ci bougent — report,
-- prolongation, correction — et effacer le texte écrit pour un jour devenu hors bornes ferait
-- perdre du travail que personne n'a demandé à jeter. L'affichage le signale, la base le garde.
CREATE TABLE `EditionProgramDay` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `editionId` INT NOT NULL,
  `date` DATE NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `EditionProgramDay_editionId_date_key`(`editionId`, `date`),
  INDEX `EditionProgramDay_editionId_idx`(`editionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EditionProgramDay`
  ADD CONSTRAINT `EditionProgramDay_editionId_fkey`
  FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

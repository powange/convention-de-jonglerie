-- Plusieurs représentations pour un même spectacle.
--
-- Un spectacle était son unique passage : il portait lui-même la date, le lieu et sa
-- publication. Le jouer deux fois — deux soirs, ou sur deux scènes — obligeait à le saisir
-- deux fois, avec titre, distribution et besoins techniques dupliqués.
--
-- Le spectacle reste l'œuvre : il garde sa durée, qui ne change pas d'un soir à l'autre, ainsi
-- que ses artistes, ses numéros et les candidatures qui le visent. Le quand et le où passent
-- dans `ShowPerformance`, et la publication avec eux : une date peut être annoncée pendant
-- qu'une autre reste en préparation.

CREATE TABLE `ShowPerformance` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `showId` INTEGER NOT NULL,
  `startDateTime` DATETIME(3) NOT NULL,
  `location` VARCHAR(191) NULL,
  `zoneId` INTEGER NULL,
  `markerId` INTEGER NULL,
  `isPublic` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `ShowPerformance_showId_idx`(`showId`),
  INDEX `ShowPerformance_showId_startDateTime_idx`(`showId`, `startDateTime`),
  INDEX `ShowPerformance_startDateTime_idx`(`startDateTime`),
  INDEX `ShowPerformance_zoneId_idx`(`zoneId`),
  INDEX `ShowPerformance_markerId_idx`(`markerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Chaque spectacle existant devient sa propre première représentation : mêmes date, lieu et
-- publication. L'organisateur ne verra aucune différence tant qu'il n'en ajoute pas d'autre.
INSERT INTO `ShowPerformance` (`showId`, `startDateTime`, `location`, `zoneId`, `markerId`, `isPublic`, `createdAt`, `updatedAt`)
SELECT `id`, `startDateTime`, `location`, `zoneId`, `markerId`, `isPublic`, `createdAt`, `updatedAt`
FROM `Show`;

ALTER TABLE `ShowPerformance` ADD CONSTRAINT `ShowPerformance_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ShowPerformance` ADD CONSTRAINT `ShowPerformance_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ShowPerformance` ADD CONSTRAINT `ShowPerformance_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Les colonnes déplacées quittent `Show`, une fois leur contenu recopié.
ALTER TABLE `Show` DROP FOREIGN KEY `Show_zoneId_fkey`;
ALTER TABLE `Show` DROP FOREIGN KEY `Show_markerId_fkey`;

DROP INDEX `Show_editionId_isPublic_idx` ON `Show`;
DROP INDEX `Show_startDateTime_idx` ON `Show`;
DROP INDEX `Show_zoneId_idx` ON `Show`;
DROP INDEX `Show_markerId_idx` ON `Show`;

ALTER TABLE `Show`
  DROP COLUMN `startDateTime`,
  DROP COLUMN `location`,
  DROP COLUMN `zoneId`,
  DROP COLUMN `markerId`,
  DROP COLUMN `isPublic`;

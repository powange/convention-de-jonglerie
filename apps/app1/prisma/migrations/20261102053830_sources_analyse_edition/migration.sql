-- Les sources d'information supplémentaires d'une édition, pour l'analyse assistée.
--
-- Purement additive : une table neuve et sa clé étrangère. Aucune donnée existante n'est touchée,
-- et une édition sans source se comporte exactement comme avant.

-- CreateTable
CREATE TABLE `EditionAnalysisSource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `label` VARCHAR(120) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionAnalysisSource_editionId_actif_idx`(`editionId`, `actif`),
    -- Unicité sur un PRÉFIXE de l'URL, et non sur sa totalité : MySQL plafonne une clé à
    -- 3072 octets, soit 768 caractères en utf8mb4, et `VARCHAR(1000)` dépasse. 500 caractères
    -- suffisent à distinguer deux adresses — deux URL identiques sur 500 caractères désignent la
    -- même page dans tous les cas réels — tout en laissant la colonne accueillir les URL à
    -- rallonge que produisent certains agendas et documents partagés.
    UNIQUE INDEX `EditionAnalysisSource_editionId_url_key`(`editionId`, `url`(500)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionAnalysisSource` ADD CONSTRAINT `EditionAnalysisSource_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

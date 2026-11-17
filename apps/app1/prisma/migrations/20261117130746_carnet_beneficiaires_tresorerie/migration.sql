-- Le carnet des bénéficiaires d'une édition : à qui l'on doit verser de l'argent.
--
-- Purement additive : une table neuve et sa clé étrangère. Aucune donnée existante n'est touchée,
-- et une édition sans bénéficiaire se comporte exactement comme avant.
--
-- 📍 Rattaché à l'ÉDITION et non à la convention, à la différence du plan comptable : un IBAN
-- confié aux organisateurs d'une année ne doit pas être lisible par ceux de toutes les autres.
-- Même décision que pour les coordonnées bancaires d'un artiste.

-- CreateTable
CREATE TABLE `TreasuryPayee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `iban` VARCHAR(34) NULL,
    `bic` VARCHAR(11) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreasuryPayee_editionId_idx`(`editionId`),
    -- Deux bénéficiaires du même nom dans une édition sont presque toujours un doublon de saisie,
    -- et ils rendraient la carte des versements illisible : deux lignes identiques, deux totaux.
    UNIQUE INDEX `TreasuryPayee_editionId_label_key`(`editionId`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TreasuryPayee` ADD CONSTRAINT `TreasuryPayee_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

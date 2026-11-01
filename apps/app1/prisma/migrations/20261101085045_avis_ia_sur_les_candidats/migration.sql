-- L'avis de la classification automatique, dans ses PROPRES colonnes.
--
-- Purement additif : trois colonnes nullables et un index. Aucune donnée existante n'est touchée,
-- et `avisIa IS NULL` sur les lignes déjà en base signifie exactement ce qu'il doit signifier —
-- « pas encore soumis au modèle ».
--
-- ⚠️ Ces colonnes ne remplacent pas `verdict` et ne s'y substituent jamais : écrire l'avis de l'IA
-- dans le verdict humain laisserait une relance automatique écraser une décision prise à la main,
-- et un refus reviendrait au balayage suivant.

-- AlterTable
ALTER TABLE `CandidatEvenement` ADD COLUMN `avisIa` ENUM('CONVENTION', 'HORS_SUJET', 'INCERTAIN') NULL,
    ADD COLUMN `avisIaLe` DATETIME(3) NULL,
    ADD COLUMN `motifIa` TEXT NULL;

-- CreateIndex
-- Les candidats que l'IA n'a pas encore vus sont précisément ceux qu'un balayage doit prendre.
CREATE INDEX `CandidatEvenement_verdict_avisIa_idx` ON `CandidatEvenement`(`verdict`, `avisIa`);

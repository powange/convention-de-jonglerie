-- Le « à régler » sur une entrée de trésorerie : à qui l'on doit verser, et si c'est fait.
--
-- Purement additive : trois colonnes nullables ou à défaut, un index, une clé étrangère. Les
-- lignes déjà saisies reçoivent `payeeId IS NULL` et `disbursed = false`, ce qui signifie
-- exactement « cette dépense n'est pas à régler à un tiers ».
--
-- ⚠️ `disbursed` — « décaissé » — et NON `settled`. Ce dernier est DÉJÀ employé dans
-- `treasury-compute.ts` pour un MONTANT en centimes : celui qui est réellement réglé, par
-- opposition à l'engagé. Un booléen du même nom l'écrasait dans le type de la ligne, et les
-- totaux additionnaient un booléen à des centimes. Seul le typage l'a vu.
--
-- 📍 `ON DELETE SET NULL`, comme pour l'avanceur : supprimer un bénéficiaire du carnet ne doit pas
-- emporter les dépenses qu'on lui devait. La ligne perd son destinataire, le montant reste.

-- AlterTable
ALTER TABLE `TreasuryEntry` ADD COLUMN `disbursed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `disbursedAt` DATETIME(3) NULL,
    ADD COLUMN `payeeId` INTEGER NULL;

-- CreateIndex
-- Ce que la carte des versements lit : les dépenses à régler d'une édition, non encore versées.
CREATE INDEX `TreasuryEntry_editionId_payeeId_disbursed_idx` ON `TreasuryEntry`(`editionId`, `payeeId`, `disbursed`);

-- AddForeignKey
ALTER TABLE `TreasuryEntry` ADD CONSTRAINT `TreasuryEntry_payeeId_fkey` FOREIGN KEY (`payeeId`) REFERENCES `TreasuryPayee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

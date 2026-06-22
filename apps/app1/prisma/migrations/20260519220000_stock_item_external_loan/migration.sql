-- Migration safe en prod : ajout de 4 colonnes nullable (sauf le boolean
-- avec DEFAULT false). Aucun backfill nécessaire : par défaut tous les
-- items existants sont considérés comme propriété de la convention.

-- AlterTable
ALTER TABLE `StockItem`
    ADD COLUMN `isExternalLoan` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ownerContact` TEXT NULL,
    ADD COLUMN `returnDueAt` DATETIME(3) NULL,
    ADD COLUMN `returnedAt` DATETIME(3) NULL;

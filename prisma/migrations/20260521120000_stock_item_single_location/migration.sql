-- Stock matériel : passage d'une répartition multi-emplacements à un
-- emplacement de rangement unique par StockItem.
--
-- 1. Ajout des 3 colonnes `location`, `zoneId`, `markerId` sur StockItem
-- 2. Backfill : pour chaque StockItem, on copie le 1er StockItemLocation
--    (par displayOrder asc, puis createdAt asc, puis id asc)
-- 3. Ajout des index + contraintes FK
-- 4. Suppression de la table StockItemLocation
--
-- Note : MySQL n'enrôle pas les DDL dans une transaction utilisateur (autocommit
-- implicite avant/après chaque ALTER/CREATE/DROP). En conséquence, si la
-- migration est interrompue entre l'étape 1 et l'étape 4, certaines des
-- nouvelles colonnes peuvent rester non backfillées. À déployer hors-trafic et
-- vérifier le succès avant de relancer.

-- 1) Ajout des colonnes (nullables).
ALTER TABLE `StockItem`
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `zoneId` INTEGER NULL,
    ADD COLUMN `markerId` INTEGER NULL;

-- 2) Backfill du 1er emplacement (par displayOrder asc, createdAt asc, id asc).
UPDATE `StockItem` si
JOIN (
    SELECT
        `stockItemId`,
        `location`,
        `zoneId`,
        `markerId`,
        ROW_NUMBER() OVER (
            PARTITION BY `stockItemId`
            ORDER BY `displayOrder` ASC, `createdAt` ASC, `id` ASC
        ) AS rn
    FROM `StockItemLocation`
) ranked
    ON ranked.`stockItemId` = si.`id` AND ranked.rn = 1
SET si.`location` = ranked.`location`,
    si.`zoneId` = ranked.`zoneId`,
    si.`markerId` = ranked.`markerId`;

-- 3) Index + FK.
CREATE INDEX `StockItem_zoneId_idx` ON `StockItem`(`zoneId`);
CREATE INDEX `StockItem_markerId_idx` ON `StockItem`(`markerId`);

ALTER TABLE `StockItem`
    ADD CONSTRAINT `StockItem_zoneId_fkey`
        FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `StockItem_markerId_fkey`
        FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) Suppression de la table StockItemLocation.
DROP TABLE `StockItemLocation`;

-- Migration safe en prod : 3 colonnes ajoutées nullable, pas de drop, pas de
-- backfill nécessaire. Les réservations existantes auront un emplacement
-- d'utilisation vide ; l'API n'exige cette valeur que lors d'une création
-- ou d'une modification touchant l'un des 3 champs.

-- AlterTable : nouveaux champs emplacement propres à la réservation
ALTER TABLE `StockReservation` ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `zoneId` INTEGER NULL,
    ADD COLUMN `markerId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `StockReservation_zoneId_idx` ON `StockReservation`(`zoneId`);

-- CreateIndex
CREATE INDEX `StockReservation_markerId_idx` ON `StockReservation`(`markerId`);

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockReservation` ADD CONSTRAINT `StockReservation_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

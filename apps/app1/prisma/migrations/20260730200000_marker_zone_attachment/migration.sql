-- Rattachement facultatif d'un marqueur à une zone : l'entrée d'une salle.
--
-- `ON DELETE SET NULL` et non `CASCADE` : supprimer une zone détache ses marqueurs sans les
-- effacer. Les quatre tables qui référencent un marqueur (Show, WorkshopLocation, StockItem,
-- StockReservation) sont elles-mêmes en SET NULL — une cascade ferait donc perdre son lieu à un
-- spectacle sans le moindre signal.
ALTER TABLE `EditionMarker` ADD COLUMN `zoneId` INT NULL;

CREATE INDEX `EditionMarker_zoneId_idx` ON `EditionMarker`(`zoneId`);

ALTER TABLE `EditionMarker`
  ADD CONSTRAINT `EditionMarker_zoneId_fkey`
  FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

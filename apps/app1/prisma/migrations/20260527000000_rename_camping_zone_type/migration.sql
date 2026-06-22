-- Renomme la valeur "CAMPING" en "TENT_CAMPING" dans les colonnes JSON
-- EditionZone.zoneTypes et EditionMarker.markerTypes suite à l'extension de
-- l'enum EditionZoneType (ajout de TRUCK_CAMPING, BAR, FIRE_SPACE, AERIAL,
-- KIDS_ZONE, CHILL_SPACE, ATM, ACCESSIBILITY, FORBIDDEN et renommage
-- CAMPING → TENT_CAMPING).
--
-- L'enum n'étant utilisé que pour le typage TypeScript (les colonnes sont
-- en JSON), aucune modification DDL n'est nécessaire — seulement la
-- mise à jour des données existantes.

UPDATE `EditionZone`
SET `zoneTypes` = CAST(REPLACE(CAST(`zoneTypes` AS CHAR), '"CAMPING"', '"TENT_CAMPING"') AS JSON)
WHERE JSON_CONTAINS(`zoneTypes`, '"CAMPING"');

UPDATE `EditionMarker`
SET `markerTypes` = CAST(REPLACE(CAST(`markerTypes` AS CHAR), '"CAMPING"', '"TENT_CAMPING"') AS JSON)
WHERE JSON_CONTAINS(`markerTypes`, '"CAMPING"');

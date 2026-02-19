-- Step 1: Add the new JSON columns with default values
ALTER TABLE `EditionZone` ADD COLUMN `zoneTypes` JSON NOT NULL DEFAULT (JSON_ARRAY('OTHER'));
ALTER TABLE `EditionMarker` ADD COLUMN `markerTypes` JSON NOT NULL DEFAULT (JSON_ARRAY('OTHER'));

-- Step 2: Migrate existing data from single enum to JSON array
UPDATE `EditionZone` SET `zoneTypes` = JSON_ARRAY(`zoneType`) WHERE `zoneType` IS NOT NULL;
UPDATE `EditionMarker` SET `markerTypes` = JSON_ARRAY(`markerType`) WHERE `markerType` IS NOT NULL;

-- Step 3: Drop the old single-value columns
ALTER TABLE `EditionZone` DROP COLUMN `zoneType`;
ALTER TABLE `EditionMarker` DROP COLUMN `markerType`;

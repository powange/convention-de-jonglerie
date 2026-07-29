-- AlterTable
ALTER TABLE `EditionMarker` ADD COLUMN `externalMapImportedAt` DATETIME(3) NULL,
    ADD COLUMN `externalMapObjectId` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `EditionZone` ADD COLUMN `externalMapImportedAt` DATETIME(3) NULL,
    ADD COLUMN `externalMapObjectId` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `EditionMarker_editionId_externalMapObjectId_key` ON `EditionMarker`(`editionId`, `externalMapObjectId`);

-- CreateIndex
CREATE UNIQUE INDEX `EditionZone_editionId_externalMapObjectId_key` ON `EditionZone`(`editionId`, `externalMapObjectId`);


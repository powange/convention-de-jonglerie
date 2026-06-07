-- AlterTable
ALTER TABLE `EditionShowCall` ADD COLUMN `askStageSetup` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `ShowApplication` ADD COLUMN `stageSetup` TEXT NULL;

-- AlterTable
ALTER TABLE `ShowPreset` ADD COLUMN `stageSetup` TEXT NULL;

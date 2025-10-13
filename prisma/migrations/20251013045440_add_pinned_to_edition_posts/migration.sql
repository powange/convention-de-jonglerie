-- AlterTable
ALTER TABLE `EditionPost` ADD COLUMN `pinned` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `EditionPost_pinned_idx` ON `EditionPost`(`pinned`);

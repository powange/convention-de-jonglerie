-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `artistsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mealsEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ticketingEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `volunteersEnabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Show_editionId_isPublic_idx` ON `Show`(`editionId`, `isPublic`);

-- AlterTable
ALTER TABLE `EditionArtist` ADD COLUMN `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `entryValidatedAt` DATETIME(3) NULL,
    ADD COLUMN `entryValidatedBy` INTEGER NULL;

-- CreateIndex
CREATE INDEX `EditionArtist_entryValidatedBy_idx` ON `EditionArtist`(`entryValidatedBy`);

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_entryValidatedBy_fkey` FOREIGN KEY (`entryValidatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

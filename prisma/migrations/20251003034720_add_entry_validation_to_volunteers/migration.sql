-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `entryValidatedAt` DATETIME(3) NULL,
    ADD COLUMN `entryValidatedBy` INTEGER NULL;

-- CreateIndex
CREATE INDEX `EditionVolunteerApplication_entryValidated_idx` ON `EditionVolunteerApplication`(`entryValidated`);

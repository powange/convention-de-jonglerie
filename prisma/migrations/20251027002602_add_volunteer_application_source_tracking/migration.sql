-- AlterTable
ALTER TABLE `EditionVolunteerApplication` ADD COLUMN `addedAt` DATETIME(3) NULL,
    ADD COLUMN `addedById` INTEGER NULL,
    ADD COLUMN `source` ENUM('APPLICATION', 'MANUAL') NOT NULL DEFAULT 'APPLICATION';

-- Migrate existing manually added volunteers
UPDATE `EditionVolunteerApplication` AS eva
INNER JOIN `Edition` AS e ON eva.editionId = e.id
SET
    eva.source = 'MANUAL',
    eva.addedById = e.creatorId,
    eva.addedAt = NOW(),
    eva.motivation = NULL
WHERE eva.motivation = 'Ajouté manuellement par un organisateur';

-- CreateIndex
CREATE INDEX `EditionVolunteerApplication_source_idx` ON `EditionVolunteerApplication`(`source`);

-- CreateIndex
CREATE INDEX `EditionVolunteerApplication_addedById_idx` ON `EditionVolunteerApplication`(`addedById`);

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

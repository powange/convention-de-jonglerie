-- Module FAQ : table FaqEntry + flags sur Edition.
-- - faqEnabled : active le module dans la gestion
-- - faqPagePublic : rend la page publique /editions/[id]/faq accessible
-- Migration safe en prod : ADD COLUMN avec DEFAULT, CREATE TABLE, pas de backfill.

-- AlterTable
ALTER TABLE `Edition`
    ADD COLUMN `faqEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `faqPagePublic` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `FaqEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `question` VARCHAR(500) NOT NULL,
    `answer` TEXT NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FaqEntry_editionId_idx`(`editionId`),
    INDEX `FaqEntry_editionId_displayOrder_idx`(`editionId`, `displayOrder`),
    INDEX `FaqEntry_editionId_isPublic_idx`(`editionId`, `isPublic`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FaqEntry` ADD CONSTRAINT `FaqEntry_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

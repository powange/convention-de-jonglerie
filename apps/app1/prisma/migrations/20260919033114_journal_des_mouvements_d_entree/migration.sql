-- CreateTable
CREATE TABLE `EntryValidationLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `participantKind` ENUM('TICKET', 'VOLUNTEER', 'ARTIST', 'ORGANIZER') NOT NULL,
    `participantId` INTEGER NOT NULL,
    `movement` ENUM('VALIDATED', 'INVALIDATED') NOT NULL,
    `actorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EntryValidationLog_editionId_createdAt_idx`(`editionId`, `createdAt`),
    INDEX `EntryValidationLog_participantKind_participantId_idx`(`participantKind`, `participantId`),
    INDEX `EntryValidationLog_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EntryValidationLog` ADD CONSTRAINT `EntryValidationLog_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EntryValidationLog` ADD CONSTRAINT `EntryValidationLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

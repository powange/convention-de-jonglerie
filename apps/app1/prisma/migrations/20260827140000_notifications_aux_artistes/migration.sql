-- Notifications groupées aux artistes d'une édition.
--
-- Les organisateurs pouvaient prévenir leurs bénévoles en un envoi, mais pas leurs artistes :
-- annoncer un horaire de passage ou un changement de plateau supposait d'écrire à chacun.
--
-- Décalque du dispositif bénévole, le périmètre portant sur des spectacles plutôt que sur des
-- équipes. `ArtistNotificationConfirmation` reçoit une ligne par destinataire dès l'envoi, avec
-- `confirmedAt` nul : c'est ce qui permet de distinguer « pas encore lu » de « jamais
-- destinataire », et donc d'afficher qui manque à l'appel.
--
-- Le nom de l'index unique est tronqué (`..._use_key`) : MySQL plafonne les identifiants à
-- 64 caractères, et c'est la forme que Prisma génère.

-- CreateTable
CREATE TABLE `ArtistNotificationGroup` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `selectedShows` JSON NULL,
    `recipientCount` INTEGER NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ArtistNotificationGroup_editionId_idx`(`editionId`),
    INDEX `ArtistNotificationGroup_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtistNotificationConfirmation` (
    `id` VARCHAR(191) NOT NULL,
    `artistNotificationGroupId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `confirmedAt` DATETIME(3) NULL,

    INDEX `ArtistNotificationConfirmation_userId_idx`(`userId`),
    UNIQUE INDEX `ArtistNotificationConfirmation_artistNotificationGroupId_use_key`(`artistNotificationGroupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ArtistNotificationGroup` ADD CONSTRAINT `ArtistNotificationGroup_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationGroup` ADD CONSTRAINT `ArtistNotificationGroup_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationConfirmation` ADD CONSTRAINT `ArtistNotificationConfirmation_artistNotificationGroupId_fkey` FOREIGN KEY (`artistNotificationGroupId`) REFERENCES `ArtistNotificationGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationConfirmation` ADD CONSTRAINT `ArtistNotificationConfirmation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `EditionArtist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `arrivalDateTime` DATETIME(3) NULL,
    `departureDateTime` DATETIME(3) NULL,
    `qrCodeToken` VARCHAR(191) NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `payment` INTEGER NULL,
    `paymentPaid` BOOLEAN NOT NULL DEFAULT false,
    `reimbursementMax` INTEGER NULL,
    `reimbursementActual` INTEGER NULL,
    `reimbursementActualPaid` BOOLEAN NOT NULL DEFAULT false,
    `consumablesMax` INTEGER NULL,
    `consumablesActual` INTEGER NULL,
    `consumablesActualPaid` BOOLEAN NOT NULL DEFAULT false,
    `reimbursementReceiptUrl` VARCHAR(191) NULL,
    `consumablesReceiptUrl` VARCHAR(191) NULL,
    `invoiceUrl` VARCHAR(191) NULL,
    `iban` VARCHAR(34) NULL,
    `bic` VARCHAR(11) NULL,
    `organizerNotes` TEXT NULL,
    `accommodationAutonomous` BOOLEAN NOT NULL DEFAULT false,
    `accommodationType` ENUM('TENT', 'VEHICLE', 'HOSTED', 'OTHER') NULL,
    `accommodationTypeOther` TEXT NULL,
    `accommodationProposal` TEXT NULL,
    `invoiceRequested` BOOLEAN NOT NULL DEFAULT false,
    `invoiceProvided` BOOLEAN NOT NULL DEFAULT false,
    `feeRequested` BOOLEAN NOT NULL DEFAULT false,
    `feeProvided` BOOLEAN NOT NULL DEFAULT false,
    `pickupRequired` BOOLEAN NOT NULL DEFAULT false,
    `pickupLocation` VARCHAR(191) NULL,
    `pickupResponsibleId` INTEGER NULL,
    `dropoffRequired` BOOLEAN NOT NULL DEFAULT false,
    `dropoffLocation` VARCHAR(191) NULL,
    `dropoffResponsibleId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `eventId` INTEGER NULL,

    UNIQUE INDEX `EditionArtist_qrCodeToken_key`(`qrCodeToken`),
    INDEX `EditionArtist_editionId_idx`(`editionId`),
    INDEX `EditionArtist_userId_idx`(`userId`),
    INDEX `EditionArtist_entryValidatedBy_idx`(`entryValidatedBy`),
    INDEX `EditionArtist_pickupResponsibleId_idx`(`pickupResponsibleId`),
    INDEX `EditionArtist_dropoffResponsibleId_idx`(`dropoffResponsibleId`),
    INDEX `EditionArtist_qrCodeToken_idx`(`qrCodeToken`),
    UNIQUE INDEX `EditionArtist_editionId_userId_key`(`editionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Show` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('STANDARD', 'CABARET') NOT NULL DEFAULT 'STANDARD',
    `companyName` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `technicalNeeds` TEXT NULL,
    `duration` INTEGER NULL,
    `imageUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `eventId` INTEGER NULL,

    INDEX `Show_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowPerformance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `location` VARCHAR(191) NULL,
    `zoneId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowPerformance_showId_idx`(`showId`),
    INDEX `ShowPerformance_showId_startDateTime_idx`(`showId`, `startDateTime`),
    INDEX `ShowPerformance_startDateTime_idx`(`startDateTime`),
    INDEX `ShowPerformance_zoneId_idx`(`zoneId`),
    INDEX `ShowPerformance_markerId_idx`(`markerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowAct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL,
    `duration` INTEGER NULL,
    `description` TEXT NULL,
    `technicalNeeds` TEXT NULL,
    `stageSetup` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowAct_showId_idx`(`showId`),
    INDEX `ShowAct_showId_position_idx`(`showId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowArtist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `actId` INTEGER NULL,
    `artistId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShowArtist_showId_idx`(`showId`),
    INDEX `ShowArtist_actId_idx`(`actId`),
    INDEX `ShowArtist_artistId_idx`(`artistId`),
    UNIQUE INDEX `ShowArtist_showId_actId_artistId_key`(`showId`, `actId`, `artistId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtistHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `artistId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ArtistHandoutItem_artistId_idx`(`artistId`),
    INDEX `ArtistHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `ArtistHandoutItem_artistId_handoutItemId_key`(`artistId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `handoutItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowHandoutItem_showId_idx`(`showId`),
    INDEX `ShowHandoutItem_handoutItemId_idx`(`handoutItemId`),
    UNIQUE INDEX `ShowHandoutItem_showId_handoutItemId_key`(`showId`, `handoutItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowPreset` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `artistName` VARCHAR(191) NOT NULL,
    `artistBio` TEXT NULL,
    `portfolioUrl` VARCHAR(191) NULL,
    `videoUrl` VARCHAR(191) NULL,
    `socialLinks` TEXT NULL,
    `showTitle` VARCHAR(191) NOT NULL,
    `showDescription` TEXT NOT NULL,
    `showDuration` INTEGER NOT NULL,
    `showCategory` VARCHAR(191) NULL,
    `technicalNeeds` TEXT NULL,
    `stageSetup` TEXT NULL,
    `additionalPerformersCount` INTEGER NOT NULL DEFAULT 0,
    `additionalPerformers` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowPreset_userId_idx`(`userId`),
    UNIQUE INDEX `ShowPreset_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtistNotificationGroup` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `senderId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `selectedShows` JSON NULL,
    `recipientCount` INTEGER NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `eventId` INTEGER NULL,

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

-- CreateTable
CREATE TABLE `TicketingHandoutItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cumulative` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `eventId` INTEGER NULL,

    INDEX `TicketingHandoutItem_editionId_idx`(`editionId`),
    UNIQUE INDEX `TicketingHandoutItem_editionId_name_key`(`editionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `phases` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `eventId` INTEGER NULL,

    INDEX `VolunteerMeal_editionId_idx`(`editionId`),
    INDEX `VolunteerMeal_date_idx`(`date`),
    UNIQUE INDEX `VolunteerMeal_editionId_date_mealType_key`(`editionId`, `date`, `mealType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArtistMealSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `artistId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `afterShow` BOOLEAN NOT NULL DEFAULT false,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ArtistMealSelection_artistId_idx`(`artistId`),
    INDEX `ArtistMealSelection_mealId_idx`(`mealId`),
    UNIQUE INDEX `ArtistMealSelection_artistId_mealId_key`(`artistId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_entryValidatedBy_fkey` FOREIGN KEY (`entryValidatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_pickupResponsibleId_fkey` FOREIGN KEY (`pickupResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_dropoffResponsibleId_fkey` FOREIGN KEY (`dropoffResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowPerformance` ADD CONSTRAINT `ShowPerformance_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowPerformance` ADD CONSTRAINT `ShowPerformance_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowPerformance` ADD CONSTRAINT `ShowPerformance_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowAct` ADD CONSTRAINT `ShowAct_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_actId_fkey` FOREIGN KEY (`actId`) REFERENCES `ShowAct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistHandoutItem` ADD CONSTRAINT `ArtistHandoutItem_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistHandoutItem` ADD CONSTRAINT `ArtistHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowHandoutItem` ADD CONSTRAINT `ShowHandoutItem_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowHandoutItem` ADD CONSTRAINT `ShowHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowPreset` ADD CONSTRAINT `ShowPreset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationGroup` ADD CONSTRAINT `ArtistNotificationGroup_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationGroup` ADD CONSTRAINT `ArtistNotificationGroup_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationConfirmation` ADD CONSTRAINT `ArtistNotificationConfirmation_artistNotificationGroupId_fkey` FOREIGN KEY (`artistNotificationGroupId`) REFERENCES `ArtistNotificationGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationConfirmation` ADD CONSTRAINT `ArtistNotificationConfirmation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingHandoutItem` ADD CONSTRAINT `TicketingHandoutItem_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMeal` ADD CONSTRAINT `VolunteerMeal_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistMealSelection` ADD CONSTRAINT `ArtistMealSelection_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistMealSelection` ADD CONSTRAINT `ArtistMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


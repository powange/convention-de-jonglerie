-- CreateTable
CREATE TABLE `EditionShowCall` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `visibility` ENUM('OFFLINE', 'CLOSED', 'PRIVATE', 'PUBLIC') NOT NULL DEFAULT 'OFFLINE',
    `mode` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
    `externalUrl` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `deadline` DATETIME(3) NULL,
    `askPortfolioUrl` BOOLEAN NOT NULL DEFAULT true,
    `askVideoUrl` BOOLEAN NOT NULL DEFAULT true,
    `askTechnicalNeeds` BOOLEAN NOT NULL DEFAULT true,
    `askStageSetup` BOOLEAN NOT NULL DEFAULT false,
    `askAccommodation` BOOLEAN NOT NULL DEFAULT false,
    `askDepartureCity` BOOLEAN NOT NULL DEFAULT false,
    `askSocialLinks` BOOLEAN NOT NULL DEFAULT false,
    `requirePhone` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `openedNotifiedAt` DATETIME(3) NULL,
    `surveyToken` VARCHAR(191) NULL,
    `surveyOpen` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `EditionShowCall_surveyToken_key`(`surveyToken`),
    INDEX `EditionShowCall_editionId_idx`(`editionId`),
    UNIQUE INDEX `EditionShowCall_editionId_name_key`(`editionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showCallId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
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
    `accommodationNeeded` BOOLEAN NOT NULL DEFAULT false,
    `accommodationNotes` TEXT NULL,
    `departureCity` VARCHAR(191) NULL,
    `organizerNotes` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `decidedById` INTEGER NULL,
    `showId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowApplication_showCallId_idx`(`showCallId`),
    INDEX `ShowApplication_userId_idx`(`userId`),
    INDEX `ShowApplication_status_idx`(`status`),
    INDEX `ShowApplication_showId_idx`(`showId`),
    UNIQUE INDEX `ShowApplication_showCallId_userId_key`(`showCallId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowCallSurveyVote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showCallId` INTEGER NOT NULL,
    `applicationId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowCallSurveyVote_showCallId_idx`(`showCallId`),
    INDEX `ShowCallSurveyVote_applicationId_idx`(`applicationId`),
    INDEX `ShowCallSurveyVote_userId_idx`(`userId`),
    UNIQUE INDEX `ShowCallSurveyVote_showCallId_applicationId_userId_key`(`showCallId`, `applicationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `showApplicationId` INTEGER NULL,
    `showId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Conversation_showApplicationId_key`(`showApplicationId`),
    UNIQUE INDEX `Conversation_showId_key`(`showId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionShowCall` ADD CONSTRAINT `EditionShowCall_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowApplication` ADD CONSTRAINT `ShowApplication_showCallId_fkey` FOREIGN KEY (`showCallId`) REFERENCES `EditionShowCall`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowApplication` ADD CONSTRAINT `ShowApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowApplication` ADD CONSTRAINT `ShowApplication_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowApplication` ADD CONSTRAINT `ShowApplication_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowCallSurveyVote` ADD CONSTRAINT `ShowCallSurveyVote_showCallId_fkey` FOREIGN KEY (`showCallId`) REFERENCES `EditionShowCall`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowCallSurveyVote` ADD CONSTRAINT `ShowCallSurveyVote_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `ShowApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowCallSurveyVote` ADD CONSTRAINT `ShowCallSurveyVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_showApplicationId_fkey` FOREIGN KEY (`showApplicationId`) REFERENCES `ShowApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


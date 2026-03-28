Loaded Prisma config from prisma.config.ts.

-- CreateTable
CREATE TABLE `EditionArtist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `arrivalDateTime` VARCHAR(191) NULL,
    `departureDateTime` VARCHAR(191) NULL,
    `dietaryPreference` ENUM('NONE', 'VEGETARIAN', 'VEGAN') NOT NULL DEFAULT 'NONE',
    `allergies` TEXT NULL,
    `allergySeverity` ENUM('LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL') NULL,
    `qrCodeToken` VARCHAR(191) NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `payment` DECIMAL(10, 2) NULL,
    `paymentPaid` BOOLEAN NOT NULL DEFAULT false,
    `reimbursementMax` DECIMAL(10, 2) NULL,
    `reimbursementActual` DECIMAL(10, 2) NULL,
    `reimbursementActualPaid` BOOLEAN NOT NULL DEFAULT false,
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
    `description` TEXT NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `duration` INTEGER NULL,
    `location` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `zoneId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Show_editionId_idx`(`editionId`),
    INDEX `Show_editionId_isPublic_idx`(`editionId`, `isPublic`),
    INDEX `Show_startDateTime_idx`(`startDateTime`),
    INDEX `Show_zoneId_idx`(`zoneId`),
    INDEX `Show_markerId_idx`(`markerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowArtist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `artistId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShowArtist_showId_idx`(`showId`),
    INDEX `ShowArtist_artistId_idx`(`artistId`),
    UNIQUE INDEX `ShowArtist_showId_artistId_key`(`showId`, `artistId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowReturnableItem_showId_idx`(`showId`),
    INDEX `ShowReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `ShowReturnableItem_showId_returnableItemId_key`(`showId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `askAccommodation` BOOLEAN NOT NULL DEFAULT false,
    `askDepartureCity` BOOLEAN NOT NULL DEFAULT false,
    `askSocialLinks` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `surveyToken` VARCHAR(191) NULL,
    `surveyOpen` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `EditionShowCall_surveyToken_key`(`surveyToken`),
    INDEX `EditionShowCall_editionId_idx`(`editionId`),
    UNIQUE INDEX `EditionShowCall_editionId_name_key`(`editionId`, `name`),
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
    `additionalPerformersCount` INTEGER NOT NULL DEFAULT 0,
    `additionalPerformers` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowPreset_userId_idx`(`userId`),
    UNIQUE INDEX `ShowPreset_userId_name_key`(`userId`, `name`),
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

    UNIQUE INDEX `ShowApplication_showId_key`(`showId`),
    INDEX `ShowApplication_showCallId_idx`(`showCallId`),
    INDEX `ShowApplication_userId_idx`(`userId`),
    INDEX `ShowApplication_status_idx`(`status`),
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
CREATE TABLE `CarpoolOffer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tripDate` DATETIME(3) NOT NULL,
    `locationCity` VARCHAR(191) NOT NULL,
    `locationAddress` VARCHAR(191) NOT NULL,
    `availableSeats` INTEGER NOT NULL,
    `direction` ENUM('TO_EVENT', 'FROM_EVENT') NOT NULL DEFAULT 'TO_EVENT',
    `description` TEXT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `smokingAllowed` BOOLEAN NOT NULL DEFAULT false,
    `petsAllowed` BOOLEAN NOT NULL DEFAULT false,
    `musicAllowed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `editionId` INTEGER NOT NULL,

    INDEX `CarpoolOffer_editionId_fkey`(`editionId`),
    INDEX `CarpoolOffer_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tripDate` DATETIME(3) NOT NULL,
    `locationCity` VARCHAR(191) NOT NULL,
    `seatsNeeded` INTEGER NOT NULL DEFAULT 1,
    `direction` ENUM('TO_EVENT', 'FROM_EVENT') NOT NULL DEFAULT 'TO_EVENT',
    `description` TEXT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `editionId` INTEGER NOT NULL,

    INDEX `CarpoolRequest_editionId_fkey`(`editionId`),
    INDEX `CarpoolRequest_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolOfferId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CarpoolComment_carpoolOfferId_fkey`(`carpoolOfferId`),
    INDEX `CarpoolComment_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolRequestComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolRequestId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CarpoolRequestComment_carpoolRequestId_fkey`(`carpoolRequestId`),
    INDEX `CarpoolRequestComment_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolPassenger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolOfferId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `addedById` INTEGER NOT NULL,

    INDEX `CarpoolPassenger_carpoolOfferId_fkey`(`carpoolOfferId`),
    INDEX `CarpoolPassenger_userId_fkey`(`userId`),
    UNIQUE INDEX `CarpoolPassenger_carpoolOfferId_userId_key`(`carpoolOfferId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolBooking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `carpoolOfferId` INTEGER NOT NULL,
    `requestId` INTEGER NULL,
    `requesterId` INTEGER NOT NULL,
    `seats` INTEGER NOT NULL,
    `message` TEXT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CarpoolBooking_carpoolOfferId_fkey`(`carpoolOfferId`),
    INDEX `CarpoolBooking_requesterId_fkey`(`requesterId`),
    INDEX `CarpoolBooking_requestId_fkey`(`requestId`),
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

    INDEX `VolunteerMeal_editionId_idx`(`editionId`),
    INDEX `VolunteerMeal_date_idx`(`date`),
    UNIQUE INDEX `VolunteerMeal_editionId_date_mealType_key`(`editionId`, `date`, `mealType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerMealSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `volunteerId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT true,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerMealSelection_volunteerId_idx`(`volunteerId`),
    INDEX `VolunteerMealSelection_mealId_idx`(`mealId`),
    UNIQUE INDEX `VolunteerMealSelection_volunteerId_mealId_key`(`volunteerId`, `mealId`),
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

-- CreateTable
CREATE TABLE `VolunteerMealReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mealId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerMealReturnableItem_mealId_idx`(`mealId`),
    INDEX `VolunteerMealReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `VolunteerMealReturnableItem_mealId_returnableItemId_key`(`mealId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTierMeal_tierId_idx`(`tierId`),
    INDEX `TicketingTierMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingTierMeal_tierId_mealId_key`(`tierId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOptionMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOptionMeal_optionId_idx`(`optionId`),
    INDEX `TicketingOptionMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingOptionMeal_optionId_mealId_key`(`optionId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrderItemMeal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderItemId` INTEGER NOT NULL,
    `mealId` INTEGER NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItemMeal_orderItemId_idx`(`orderItemId`),
    INDEX `TicketingOrderItemMeal_mealId_idx`(`mealId`),
    UNIQUE INDEX `TicketingOrderItemMeal_orderItemId_mealId_key`(`orderItemId`, `mealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NULL,
    `teamId` VARCHAR(191) NULL,
    `showApplicationId` INTEGER NULL,
    `type` ENUM('TEAM_GROUP', 'TEAM_LEADER_PRIVATE', 'VOLUNTEER_TO_ORGANIZERS', 'ORGANIZERS_GROUP', 'PRIVATE', 'ARTIST_APPLICATION') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Conversation_showApplicationId_key`(`showApplicationId`),
    INDEX `Conversation_editionId_idx`(`editionId`),
    INDEX `Conversation_teamId_idx`(`teamId`),
    INDEX `Conversation_showApplicationId_idx`(`showApplicationId`),
    INDEX `Conversation_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,
    `lastReadAt` DATETIME(3) NULL,
    `lastReadMessageId` VARCHAR(191) NULL,

    INDEX `ConversationParticipant_conversationId_idx`(`conversationId`),
    INDEX `ConversationParticipant_userId_idx`(`userId`),
    INDEX `ConversationParticipant_leftAt_idx`(`leftAt`),
    INDEX `ConversationParticipant_lastReadMessageId_idx`(`lastReadMessageId`),
    UNIQUE INDEX `ConversationParticipant_conversationId_userId_key`(`conversationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `participantId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `replyToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Message_conversationId_idx`(`conversationId`),
    INDEX `Message_participantId_idx`(`participantId`),
    INDEX `Message_createdAt_idx`(`createdAt`),
    INDEX `Message_replyToId_idx`(`replyToId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LostFoundItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `status` ENUM('LOST', 'RETURNED') NOT NULL DEFAULT 'LOST',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LostFoundItem_editionId_fkey`(`editionId`),
    INDEX `LostFoundItem_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LostFoundComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lostFoundItemId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LostFoundComment_lostFoundItemId_fkey`(`lostFoundItemId`),
    INDEX `LostFoundComment_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('BUG', 'SUGGESTION', 'GENERAL', 'COMPLAINT') NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `userAgent` TEXT NULL,
    `url` TEXT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Feedback_userId_fkey`(`userId`),
    INDEX `Feedback_type_idx`(`type`),
    INDEX `Feedback_resolved_idx`(`resolved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiErrorLog` (
    `id` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `stack` LONGTEXT NULL,
    `errorType` VARCHAR(191) NULL,
    `method` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `userAgent` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `referer` TEXT NULL,
    `origin` VARCHAR(191) NULL,
    `headers` JSON NULL,
    `body` JSON NULL,
    `queryParams` JSON NULL,
    `prismaDetails` JSON NULL,
    `userId` INTEGER NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedBy` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApiErrorLog_createdAt_idx`(`createdAt`),
    INDEX `ApiErrorLog_statusCode_idx`(`statusCode`),
    INDEX `ApiErrorLog_path_idx`(`path`),
    INDEX `ApiErrorLog_userId_idx`(`userId`),
    INDEX `ApiErrorLog_resolved_idx`(`resolved`),
    INDEX `ApiErrorLog_resolved_createdAt_idx`(`resolved`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` ENUM('INFO', 'SUCCESS', 'WARNING', 'ERROR') NOT NULL,
    `titleKey` VARCHAR(191) NULL,
    `messageKey` VARCHAR(191) NULL,
    `translationParams` JSON NULL,
    `actionTextKey` VARCHAR(191) NULL,
    `titleText` TEXT NULL,
    `messageText` TEXT NULL,
    `actionText` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `actionUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Notification_userId_idx`(`userId`),
    INDEX `Notification_isRead_idx`(`isRead`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    INDEX `Notification_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FcmToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `deviceId` VARCHAR(100) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FcmToken_userId_idx`(`userId`),
    INDEX `FcmToken_token_idx`(`token`),
    INDEX `FcmToken_deviceId_idx`(`deviceId`),
    UNIQUE INDEX `FcmToken_userId_token_key`(`userId`, `token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectExpense` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('DOMAIN', 'HOSTING', 'HARDWARE', 'ELECTRICITY', 'SOFTWARE', 'SERVICE', 'OTHER') NOT NULL,
    `icon` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProjectExpense_isActive_idx`(`isActive`),
    INDEX `ProjectExpense_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectExpenseRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `expenseId` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    `period` ENUM('MONTHLY', 'YEARLY', 'ONE_TIME') NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_project_expense_rate_expense`(`expenseId`),
    INDEX `ProjectExpenseRate_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StripeConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `publicKey` TEXT NOT NULL,
    `secretKey` TEXT NOT NULL,
    `webhookSecret` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeEstimateConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fixedHours` DECIMAL(10, 1) NOT NULL,
    `referenceDate` DATETIME(3) NOT NULL,
    `weeklyHours` DECIMAL(5, 1) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CoffeeDonation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stripeSessionId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `totalCents` INTEGER NOT NULL,
    `feeCents` INTEGER NULL,
    `netCents` INTEGER NULL,
    `email` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CoffeeDonation_stripeSessionId_key`(`stripeSessionId`),
    INDEX `CoffeeDonation_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `emailHash` VARCHAR(191) NOT NULL,
    `pseudo` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NULL,
    `prenom` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `authProvider` VARCHAR(191) NOT NULL DEFAULT 'email',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `profilePicture` VARCHAR(191) NULL,
    `emailVerificationCode` VARCHAR(191) NULL,
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `verificationCodeExpiry` DATETIME(3) NULL,
    `isGlobalAdmin` BOOLEAN NOT NULL DEFAULT false,
    `phone` VARCHAR(191) NULL,
    `preferredLanguage` VARCHAR(191) NOT NULL DEFAULT 'fr',
    `notificationPreferences` JSON NULL,
    `isVolunteer` BOOLEAN NOT NULL DEFAULT false,
    `isArtist` BOOLEAN NOT NULL DEFAULT false,
    `isOrganizer` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_pseudo_key`(`pseudo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Edition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `program` TEXT NULL,
    `artistInfo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `creatorId` INTEGER NULL,
    `endDate` DATETIME(3) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `facebookUrl` VARCHAR(191) NULL,
    `instagramUrl` VARCHAR(191) NULL,
    `ticketingUrl` VARCHAR(191) NULL,
    `jugglingEdgeUrl` VARCHAR(191) NULL,
    `acceptsPets` BOOLEAN NOT NULL DEFAULT false,
    `hasFoodTrucks` BOOLEAN NOT NULL DEFAULT false,
    `hasGym` BOOLEAN NOT NULL DEFAULT false,
    `hasKidsZone` BOOLEAN NOT NULL DEFAULT false,
    `hasTentCamping` BOOLEAN NOT NULL DEFAULT false,
    `hasTruckCamping` BOOLEAN NOT NULL DEFAULT false,
    `imageUrl` VARCHAR(191) NULL,
    `hasAccessibility` BOOLEAN NOT NULL DEFAULT false,
    `hasAerialSpace` BOOLEAN NOT NULL DEFAULT false,
    `hasCantine` BOOLEAN NOT NULL DEFAULT false,
    `hasConcert` BOOLEAN NOT NULL DEFAULT false,
    `hasFamilyCamping` BOOLEAN NOT NULL DEFAULT false,
    `hasSleepingRoom` BOOLEAN NOT NULL DEFAULT false,
    `hasFireSpace` BOOLEAN NOT NULL DEFAULT false,
    `hasGala` BOOLEAN NOT NULL DEFAULT false,
    `hasOpenStage` BOOLEAN NOT NULL DEFAULT false,
    `hasShowers` BOOLEAN NOT NULL DEFAULT false,
    `hasSlacklineSpace` BOOLEAN NOT NULL DEFAULT false,
    `hasUnicycleSpace` BOOLEAN NOT NULL DEFAULT false,
    `hasToilets` BOOLEAN NOT NULL DEFAULT false,
    `hasWorkshops` BOOLEAN NOT NULL DEFAULT false,
    `hasCashPayment` BOOLEAN NOT NULL DEFAULT false,
    `hasCreditCardPayment` BOOLEAN NOT NULL DEFAULT false,
    `hasAfjTokenPayment` BOOLEAN NOT NULL DEFAULT false,
    `conventionId` INTEGER NOT NULL,
    `hasATM` BOOLEAN NOT NULL DEFAULT false,
    `hasLongShow` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PLANNED', 'PUBLISHED', 'OFFLINE', 'CANCELLED') NOT NULL DEFAULT 'OFFLINE',
    `volunteersEnabled` BOOLEAN NOT NULL DEFAULT false,
    `volunteersDescription` TEXT NULL,
    `volunteersOpen` BOOLEAN NOT NULL DEFAULT false,
    `volunteersUpdatedAt` DATETIME(3) NULL,
    `volunteersExternalUrl` VARCHAR(191) NULL,
    `volunteersMode` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
    `volunteersAskDiet` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskAllergies` BOOLEAN NOT NULL DEFAULT false,
    `officialWebsiteUrl` VARCHAR(191) NULL,
    `volunteersAskTimePreferences` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskTeamPreferences` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskPets` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskMinors` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskVehicle` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskCompanion` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskAvoidList` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskSkills` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskExperience` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskEmergencyContact` BOOLEAN NOT NULL DEFAULT false,
    `volunteersTeardownEndDate` DATETIME(3) NULL,
    `volunteersSetupStartDate` DATETIME(3) NULL,
    `volunteersAskSetup` BOOLEAN NOT NULL DEFAULT false,
    `volunteersAskTeardown` BOOLEAN NOT NULL DEFAULT false,
    `mealsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `artistsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `ticketingEnabled` BOOLEAN NOT NULL DEFAULT false,
    `ticketingAllowOnsiteRegistration` BOOLEAN NOT NULL DEFAULT true,
    `ticketingAllowAnonymousOrders` BOOLEAN NOT NULL DEFAULT false,
    `ticketingPaymentCash` BOOLEAN NOT NULL DEFAULT true,
    `ticketingPaymentCard` BOOLEAN NOT NULL DEFAULT true,
    `ticketingPaymentCheck` BOOLEAN NOT NULL DEFAULT true,
    `ticketingSumupEnabled` BOOLEAN NOT NULL DEFAULT false,
    `workshopsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `workshopLocationsFreeInput` BOOLEAN NOT NULL DEFAULT false,
    `siteMapEnabled` BOOLEAN NOT NULL DEFAULT false,
    `mapPublic` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Edition_creatorId_fkey`(`creatorId`),
    INDEX `Edition_conventionId_fkey`(`conventionId`),
    INDEX `Edition_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Convention` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `logo` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `authorId` INTEGER NULL,
    `archivedAt` DATETIME(3) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Convention_authorId_fkey`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConventionClaimRequest` (
    `id` VARCHAR(191) NOT NULL,
    `conventionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConventionClaimRequest_code_key`(`code`),
    INDEX `ConventionClaimRequest_conventionId_idx`(`conventionId`),
    INDEX `ConventionClaimRequest_userId_idx`(`userId`),
    INDEX `ConventionClaimRequest_code_idx`(`code`),
    INDEX `ConventionClaimRequest_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `ConventionClaimRequest_conventionId_userId_key`(`conventionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConventionOrganizer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `addedById` INTEGER NOT NULL,
    `canAddEdition` BOOLEAN NOT NULL DEFAULT false,
    `canDeleteAllEditions` BOOLEAN NOT NULL DEFAULT false,
    `canDeleteConvention` BOOLEAN NOT NULL DEFAULT false,
    `canEditAllEditions` BOOLEAN NOT NULL DEFAULT false,
    `canEditConvention` BOOLEAN NOT NULL DEFAULT false,
    `canManageOrganizers` BOOLEAN NOT NULL DEFAULT false,
    `title` VARCHAR(191) NULL,
    `canManageVolunteers` BOOLEAN NOT NULL DEFAULT false,
    `canManageArtists` BOOLEAN NOT NULL DEFAULT false,
    `canManageMeals` BOOLEAN NOT NULL DEFAULT false,
    `canManageTicketing` BOOLEAN NOT NULL DEFAULT false,

    INDEX `ConventionOrganizer_addedById_fkey`(`addedById`),
    INDEX `ConventionOrganizer_userId_fkey`(`userId`),
    UNIQUE INDEX `ConventionOrganizer_conventionId_userId_key`(`conventionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionOrganizerPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `organizerId` INTEGER NOT NULL,
    `editionId` INTEGER NOT NULL,
    `canEdit` BOOLEAN NOT NULL DEFAULT false,
    `canDelete` BOOLEAN NOT NULL DEFAULT false,
    `canManageVolunteers` BOOLEAN NOT NULL DEFAULT false,
    `canManageArtists` BOOLEAN NOT NULL DEFAULT false,
    `canManageMeals` BOOLEAN NOT NULL DEFAULT false,
    `canManageTicketing` BOOLEAN NOT NULL DEFAULT false,

    INDEX `EditionOrganizerPermission_editionId_idx`(`editionId`),
    UNIQUE INDEX `EditionOrganizerPermission_organizerId_editionId_key`(`organizerId`, `editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionOrganizer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `organizerId` INTEGER NOT NULL,
    `qrCodeToken` VARCHAR(191) NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EditionOrganizer_qrCodeToken_key`(`qrCodeToken`),
    INDEX `EditionOrganizer_editionId_idx`(`editionId`),
    INDEX `EditionOrganizer_organizerId_idx`(`organizerId`),
    INDEX `EditionOrganizer_entryValidatedBy_idx`(`entryValidatedBy`),
    INDEX `EditionOrganizer_qrCodeToken_idx`(`qrCodeToken`),
    UNIQUE INDEX `EditionOrganizer_editionId_organizerId_key`(`editionId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizerPermissionHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `changeType` ENUM('CREATED', 'RIGHTS_UPDATED', 'PER_EDITIONS_UPDATED', 'ARCHIVED', 'UNARCHIVED', 'REMOVED') NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `targetUserId` INTEGER NULL,

    INDEX `OrganizerPermissionHistory_conventionId_idx`(`conventionId`),
    INDEX `OrganizerPermissionHistory_actorId_idx`(`actorId`),
    INDEX `OrganizerPermissionHistory_changeType_idx`(`changeType`),
    INDEX `OrganizerPermissionHistory_targetUserId_idx`(`targetUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionPost_editionId_fkey`(`editionId`),
    INDEX `EditionPost_userId_fkey`(`userId`),
    INDEX `EditionPost_pinned_idx`(`pinned`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionPostComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionPostId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionPostComment_editionPostId_fkey`(`editionPostId`),
    INDEX `EditionPostComment_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `used` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `PasswordResetToken_token_key`(`token`),
    INDEX `PasswordResetToken_userId_fkey`(`userId`),
    INDEX `PasswordResetToken_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionZone` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NOT NULL,
    `coordinates` JSON NOT NULL,
    `zoneTypes` JSON NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionZone_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionMarker` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `markerTypes` JSON NOT NULL,
    `color` VARCHAR(7) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionMarker_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExternalTicketing` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `provider` ENUM('HELLOASSO', 'INFOMANIAK', 'BILLETWEB', 'WEEZEVENT', 'OTHER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ERROR') NOT NULL DEFAULT 'ACTIVE',
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExternalTicketing_editionId_key`(`editionId`),
    INDEX `ExternalTicketing_editionId_idx`(`editionId`),
    INDEX `ExternalTicketing_provider_idx`(`provider`),
    INDEX `ExternalTicketing_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HelloAssoConfig` (
    `id` VARCHAR(191) NOT NULL,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` VARCHAR(191) NOT NULL,
    `organizationSlug` VARCHAR(191) NOT NULL,
    `formType` VARCHAR(191) NOT NULL,
    `formSlug` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `HelloAssoConfig_externalTicketingId_key`(`externalTicketingId`),
    INDEX `HelloAssoConfig_externalTicketingId_idx`(`externalTicketingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InfomaniakConfig` (
    `id` VARCHAR(191) NOT NULL,
    `externalTicketingId` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `apiKeyGuichet` VARCHAR(191) NULL,
    `applicationPassword` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT '2',
    `eventId` INTEGER NULL,
    `eventName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InfomaniakConfig_externalTicketingId_key`(`externalTicketingId`),
    INDEX `InfomaniakConfig_externalTicketingId_idx`(`externalTicketingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NULL,
    `helloAssoTierId` INTEGER NULL,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `customName` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `price` INTEGER NOT NULL,
    `minAmount` INTEGER NULL,
    `maxAmount` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `countAsParticipant` BOOLEAN NOT NULL DEFAULT true,
    `validFrom` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTier_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingTier_editionId_idx`(`editionId`),
    UNIQUE INDEX `TicketingTier_externalTicketingId_helloAssoTierId_key`(`externalTicketingId`, `helloAssoTierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingQuota_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingReturnableItem_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionVolunteerReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionVolunteerReturnableItem_editionId_idx`(`editionId`),
    INDEX `EditionVolunteerReturnableItem_returnableItemId_idx`(`returnableItemId`),
    INDEX `EditionVolunteerReturnableItem_teamId_idx`(`teamId`),
    UNIQUE INDEX `EditionVolunteerReturnableItem_editionId_returnableItemId_te_key`(`editionId`, `returnableItemId`, `teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionOrganizerReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `organizerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionOrganizerReturnableItem_editionId_idx`(`editionId`),
    INDEX `EditionOrganizerReturnableItem_returnableItemId_idx`(`returnableItemId`),
    INDEX `EditionOrganizerReturnableItem_organizerId_idx`(`organizerId`),
    UNIQUE INDEX `EditionOrganizerReturnableItem_editionId_returnableItemId_or_key`(`editionId`, `returnableItemId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,

    INDEX `TicketingTierQuota_tierId_idx`(`tierId`),
    INDEX `TicketingTierQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TicketingTierQuota_tierId_quotaId_key`(`tierId`, `quotaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,

    INDEX `TicketingTierReturnableItem_tierId_idx`(`tierId`),
    INDEX `TicketingTierReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `TicketingTierReturnableItem_tierId_returnableItemId_key`(`tierId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,

    INDEX `TicketingTierOption_tierId_idx`(`tierId`),
    INDEX `TicketingTierOption_optionId_idx`(`optionId`),
    UNIQUE INDEX `TicketingTierOption_tierId_optionId_key`(`tierId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOptionQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,

    INDEX `TicketingOptionQuota_optionId_idx`(`optionId`),
    INDEX `TicketingOptionQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TicketingOptionQuota_optionId_quotaId_key`(`optionId`, `quotaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOptionReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `optionId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,

    INDEX `TicketingOptionReturnableItem_optionId_idx`(`optionId`),
    INDEX `TicketingOptionReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `TicketingOptionReturnableItem_optionId_returnableItemId_key`(`optionId`, `returnableItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NULL,
    `helloAssoOptionId` VARCHAR(191) NULL,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `choices` JSON NULL,
    `price` INTEGER NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOption_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingOption_editionId_idx`(`editionId`),
    UNIQUE INDEX `TicketingOption_externalTicketingId_helloAssoOptionId_key`(`externalTicketingId`, `helloAssoOptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalTicketingId` VARCHAR(191) NULL,
    `helloAssoOrderId` INTEGER NULL,
    `editionId` INTEGER NOT NULL,
    `payerFirstName` VARCHAR(191) NOT NULL,
    `payerLastName` VARCHAR(191) NOT NULL,
    `payerEmail` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `checkNumber` VARCHAR(191) NULL,
    `orderDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrder_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingOrder_editionId_idx`(`editionId`),
    INDEX `TicketingOrder_payerEmail_idx`(`payerEmail`),
    UNIQUE INDEX `TicketingOrder_externalTicketingId_helloAssoOrderId_key`(`externalTicketingId`, `helloAssoOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `helloAssoItemId` INTEGER NULL,
    `tierId` INTEGER NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `qrCode` VARCHAR(191) NULL,
    `customFields` JSON NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItem_orderId_idx`(`orderId`),
    INDEX `TicketingOrderItem_tierId_idx`(`tierId`),
    INDEX `TicketingOrderItem_helloAssoItemId_idx`(`helloAssoItemId`),
    INDEX `TicketingOrderItem_email_idx`(`email`),
    INDEX `TicketingOrderItem_qrCode_idx`(`qrCode`),
    INDEX `TicketingOrderItem_entryValidated_idx`(`entryValidated`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomField` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `helloAssoCustomFieldId` INTEGER NULL,
    `externalTicketingId` VARCHAR(191) NULL,
    `editionId` INTEGER NOT NULL,
    `label` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `values` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingTierCustomField_externalTicketingId_idx`(`externalTicketingId`),
    INDEX `TicketingTierCustomField_editionId_idx`(`editionId`),
    UNIQUE INDEX `TicketingTierCustomField_externalTicketingId_helloAssoCustom_key`(`externalTicketingId`, `helloAssoCustomFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldAssociation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tierId` INTEGER NOT NULL,
    `customFieldId` INTEGER NOT NULL,

    INDEX `TicketingTierCustomFieldAssociation_tierId_idx`(`tierId`),
    INDEX `TicketingTierCustomFieldAssociation_customFieldId_idx`(`customFieldId`),
    UNIQUE INDEX `TicketingTierCustomFieldAssociation_tierId_customFieldId_key`(`tierId`, `customFieldId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldQuota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customFieldId` INTEGER NOT NULL,
    `quotaId` INTEGER NOT NULL,
    `choiceValue` VARCHAR(191) NULL,

    INDEX `TicketingTierCustomFieldQuota_customFieldId_idx`(`customFieldId`),
    INDEX `TicketingTierCustomFieldQuota_quotaId_idx`(`quotaId`),
    UNIQUE INDEX `TicketingTierCustomFieldQuota_customFieldId_quotaId_choiceVa_key`(`customFieldId`, `quotaId`, `choiceValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingTierCustomFieldReturnableItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customFieldId` INTEGER NOT NULL,
    `returnableItemId` INTEGER NOT NULL,
    `choiceValue` VARCHAR(191) NULL,

    INDEX `TicketingTierCustomFieldReturnableItem_customFieldId_idx`(`customFieldId`),
    INDEX `TicketingTierCustomFieldReturnableItem_returnableItemId_idx`(`returnableItemId`),
    UNIQUE INDEX `TicketingTierCustomFieldReturnableItem_customFieldId_returna_key`(`customFieldId`, `returnableItemId`, `choiceValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingOrderItemOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderItemId` INTEGER NOT NULL,
    `optionId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `customFields` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketingOrderItemOption_orderItemId_idx`(`orderItemId`),
    INDEX `TicketingOrderItemOption_optionId_idx`(`optionId`),
    UNIQUE INDEX `TicketingOrderItemOption_orderItemId_optionId_key`(`orderItemId`, `optionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketingCounter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TicketingCounter_token_key`(`token`),
    INDEX `TicketingCounter_editionId_idx`(`editionId`),
    INDEX `TicketingCounter_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionVolunteerApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `motivation` TEXT NULL,
    `allergies` TEXT NULL,
    `allergySeverity` ENUM('LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `decidedAt` DATETIME(3) NULL,
    `userSnapshotPhone` VARCHAR(191) NULL,
    `dietaryPreference` ENUM('NONE', 'VEGETARIAN', 'VEGAN') NOT NULL DEFAULT 'NONE',
    `timePreferences` JSON NULL,
    `teamPreferences` JSON NULL,
    `acceptanceNote` TEXT NULL,
    `hasPets` BOOLEAN NULL,
    `petsDetails` TEXT NULL,
    `hasMinors` BOOLEAN NULL,
    `minorsDetails` TEXT NULL,
    `hasVehicle` BOOLEAN NULL,
    `vehicleDetails` TEXT NULL,
    `companionName` TEXT NULL,
    `avoidList` TEXT NULL,
    `skills` TEXT NULL,
    `hasExperience` BOOLEAN NULL,
    `experienceDetails` TEXT NULL,
    `setupAvailability` BOOLEAN NULL,
    `teardownAvailability` BOOLEAN NULL,
    `eventAvailability` BOOLEAN NULL,
    `arrivalDateTime` VARCHAR(191) NULL,
    `departureDateTime` VARCHAR(191) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `qrCodeToken` VARCHAR(191) NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `source` ENUM('APPLICATION', 'MANUAL') NOT NULL DEFAULT 'APPLICATION',
    `addedById` INTEGER NULL,
    `addedAt` DATETIME(3) NULL,

    UNIQUE INDEX `EditionVolunteerApplication_qrCodeToken_key`(`qrCodeToken`),
    INDEX `EditionVolunteerApplication_editionId_idx`(`editionId`),
    INDEX `EditionVolunteerApplication_status_idx`(`status`),
    INDEX `EditionVolunteerApplication_userId_fkey`(`userId`),
    INDEX `EditionVolunteerApplication_entryValidated_idx`(`entryValidated`),
    INDEX `EditionVolunteerApplication_source_idx`(`source`),
    INDEX `EditionVolunteerApplication_addedById_idx`(`addedById`),
    INDEX `EditionVolunteerApplication_qrCodeToken_idx`(`qrCodeToken`),
    UNIQUE INDEX `EditionVolunteerApplication_editionId_userId_key`(`editionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerNotificationGroup` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `selectedTeams` JSON NULL,
    `recipientCount` INTEGER NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VolunteerNotificationGroup_editionId_idx`(`editionId`),
    INDEX `VolunteerNotificationGroup_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerNotificationConfirmation` (
    `id` VARCHAR(191) NOT NULL,
    `volunteerNotificationGroupId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `confirmedAt` DATETIME(3) NULL,

    INDEX `VolunteerNotificationConfirmation_userId_idx`(`userId`),
    UNIQUE INDEX `VolunteerNotificationConfirmation_volunteerNotificationGroup_key`(`volunteerNotificationGroupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerTeam` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    `maxVolunteers` INTEGER NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `isAccessControlTeam` BOOLEAN NOT NULL DEFAULT false,
    `isMealValidationTeam` BOOLEAN NOT NULL DEFAULT false,
    `isVisibleToVolunteers` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerTeam_editionId_idx`(`editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerTimeSlot` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `endDateTime` DATETIME(3) NOT NULL,
    `maxVolunteers` INTEGER NOT NULL DEFAULT 1,
    `assignedVolunteers` INTEGER NOT NULL DEFAULT 0,
    `delayMinutes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerTimeSlot_editionId_idx`(`editionId`),
    INDEX `VolunteerTimeSlot_teamId_idx`(`teamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `timeSlotId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedById` INTEGER NOT NULL,

    INDEX `VolunteerAssignment_timeSlotId_idx`(`timeSlotId`),
    INDEX `VolunteerAssignment_userId_idx`(`userId`),
    INDEX `VolunteerAssignment_assignedById_idx`(`assignedById`),
    UNIQUE INDEX `VolunteerAssignment_timeSlotId_userId_key`(`timeSlotId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationTeamAssignment` (
    `applicationId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `isLeader` BOOLEAN NOT NULL DEFAULT false,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApplicationTeamAssignment_teamId_idx`(`teamId`),
    INDEX `ApplicationTeamAssignment_isLeader_idx`(`isLeader`),
    PRIMARY KEY (`applicationId`, `teamId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `editionId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerComment_userId_idx`(`userId`),
    INDEX `VolunteerComment_editionId_idx`(`editionId`),
    UNIQUE INDEX `VolunteerComment_userId_editionId_key`(`userId`, `editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workshop` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `creatorId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `endDateTime` DATETIME(3) NOT NULL,
    `maxParticipants` INTEGER NULL,
    `locationId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Workshop_editionId_idx`(`editionId`),
    INDEX `Workshop_creatorId_idx`(`creatorId`),
    INDEX `Workshop_startDateTime_idx`(`startDateTime`),
    INDEX `Workshop_locationId_idx`(`locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkshopFavorite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workshopId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkshopFavorite_workshopId_idx`(`workshopId`),
    INDEX `WorkshopFavorite_userId_idx`(`userId`),
    UNIQUE INDEX `WorkshopFavorite_workshopId_userId_key`(`workshopId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkshopLocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `zoneId` INTEGER NULL,
    `markerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkshopLocation_editionId_idx`(`editionId`),
    INDEX `WorkshopLocation_zoneId_idx`(`zoneId`),
    INDEX `WorkshopLocation_markerId_idx`(`markerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_FavoriteEditions` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_FavoriteEditions_AB_unique`(`A`, `B`),
    INDEX `_FavoriteEditions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_AttendingEditions` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_AttendingEditions_AB_unique`(`A`, `B`),
    INDEX `_AttendingEditions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_entryValidatedBy_fkey` FOREIGN KEY (`entryValidatedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_pickupResponsibleId_fkey` FOREIGN KEY (`pickupResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionArtist` ADD CONSTRAINT `EditionArtist_dropoffResponsibleId_fkey` FOREIGN KEY (`dropoffResponsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Show` ADD CONSTRAINT `Show_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowArtist` ADD CONSTRAINT `ShowArtist_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowReturnableItem` ADD CONSTRAINT `ShowReturnableItem_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowReturnableItem` ADD CONSTRAINT `ShowReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionShowCall` ADD CONSTRAINT `EditionShowCall_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowPreset` ADD CONSTRAINT `ShowPreset_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `CarpoolOffer` ADD CONSTRAINT `CarpoolOffer_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolOffer` ADD CONSTRAINT `CarpoolOffer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequest` ADD CONSTRAINT `CarpoolRequest_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequest` ADD CONSTRAINT `CarpoolRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolComment` ADD CONSTRAINT `CarpoolComment_carpoolOfferId_fkey` FOREIGN KEY (`carpoolOfferId`) REFERENCES `CarpoolOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolComment` ADD CONSTRAINT `CarpoolComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequestComment` ADD CONSTRAINT `CarpoolRequestComment_carpoolRequestId_fkey` FOREIGN KEY (`carpoolRequestId`) REFERENCES `CarpoolRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequestComment` ADD CONSTRAINT `CarpoolRequestComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolPassenger` ADD CONSTRAINT `CarpoolPassenger_carpoolOfferId_fkey` FOREIGN KEY (`carpoolOfferId`) REFERENCES `CarpoolOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolPassenger` ADD CONSTRAINT `CarpoolPassenger_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_carpoolOfferId_fkey` FOREIGN KEY (`carpoolOfferId`) REFERENCES `CarpoolOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `CarpoolRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMeal` ADD CONSTRAINT `VolunteerMeal_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealSelection` ADD CONSTRAINT `VolunteerMealSelection_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `EditionVolunteerApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealSelection` ADD CONSTRAINT `VolunteerMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistMealSelection` ADD CONSTRAINT `ArtistMealSelection_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `EditionArtist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistMealSelection` ADD CONSTRAINT `ArtistMealSelection_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealReturnableItem` ADD CONSTRAINT `VolunteerMealReturnableItem_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealReturnableItem` ADD CONSTRAINT `VolunteerMealReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierMeal` ADD CONSTRAINT `TicketingTierMeal_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierMeal` ADD CONSTRAINT `TicketingTierMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionMeal` ADD CONSTRAINT `TicketingOptionMeal_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionMeal` ADD CONSTRAINT `TicketingOptionMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemMeal` ADD CONSTRAINT `TicketingOrderItemMeal_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `TicketingOrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemMeal` ADD CONSTRAINT `TicketingOrderItemMeal_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_showApplicationId_fkey` FOREIGN KEY (`showApplicationId`) REFERENCES `ShowApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_lastReadMessageId_fkey` FOREIGN KEY (`lastReadMessageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `ConversationParticipant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_replyToId_fkey` FOREIGN KEY (`replyToId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundItem` ADD CONSTRAINT `LostFoundItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundItem` ADD CONSTRAINT `LostFoundItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundComment` ADD CONSTRAINT `LostFoundComment_lostFoundItemId_fkey` FOREIGN KEY (`lostFoundItemId`) REFERENCES `LostFoundItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundComment` ADD CONSTRAINT `LostFoundComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiErrorLog` ADD CONSTRAINT `ApiErrorLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FcmToken` ADD CONSTRAINT `FcmToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectExpenseRate` ADD CONSTRAINT `ProjectExpenseRate_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `ProjectExpense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionClaimRequest` ADD CONSTRAINT `ConventionClaimRequest_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionClaimRequest` ADD CONSTRAINT `ConventionClaimRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionOrganizer` ADD CONSTRAINT `ConventionOrganizer_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionOrganizer` ADD CONSTRAINT `ConventionOrganizer_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionOrganizer` ADD CONSTRAINT `ConventionOrganizer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerPermission` ADD CONSTRAINT `EditionOrganizerPermission_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `ConventionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerPermission` ADD CONSTRAINT `EditionOrganizerPermission_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizer` ADD CONSTRAINT `EditionOrganizer_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizer` ADD CONSTRAINT `EditionOrganizer_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `ConventionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerPermissionHistory` ADD CONSTRAINT `OrganizerPermissionHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerPermissionHistory` ADD CONSTRAINT `OrganizerPermissionHistory_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerPermissionHistory` ADD CONSTRAINT `OrganizerPermissionHistory_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPost` ADD CONSTRAINT `EditionPost_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPost` ADD CONSTRAINT `EditionPost_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPostComment` ADD CONSTRAINT `EditionPostComment_editionPostId_fkey` FOREIGN KEY (`editionPostId`) REFERENCES `EditionPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPostComment` ADD CONSTRAINT `EditionPostComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionZone` ADD CONSTRAINT `EditionZone_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionMarker` ADD CONSTRAINT `EditionMarker_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExternalTicketing` ADD CONSTRAINT `ExternalTicketing_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HelloAssoConfig` ADD CONSTRAINT `HelloAssoConfig_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InfomaniakConfig` ADD CONSTRAINT `InfomaniakConfig_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTier` ADD CONSTRAINT `TicketingTier_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTier` ADD CONSTRAINT `TicketingTier_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingQuota` ADD CONSTRAINT `TicketingQuota_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingReturnableItem` ADD CONSTRAINT `TicketingReturnableItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerReturnableItem` ADD CONSTRAINT `EditionVolunteerReturnableItem_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerReturnableItem` ADD CONSTRAINT `EditionOrganizerReturnableItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerReturnableItem` ADD CONSTRAINT `EditionOrganizerReturnableItem_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierQuota` ADD CONSTRAINT `TicketingTierQuota_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierQuota` ADD CONSTRAINT `TicketingTierQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierReturnableItem` ADD CONSTRAINT `TicketingTierReturnableItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierReturnableItem` ADD CONSTRAINT `TicketingTierReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierOption` ADD CONSTRAINT `TicketingTierOption_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierOption` ADD CONSTRAINT `TicketingTierOption_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionQuota` ADD CONSTRAINT `TicketingOptionQuota_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionQuota` ADD CONSTRAINT `TicketingOptionQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionReturnableItem` ADD CONSTRAINT `TicketingOptionReturnableItem_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionReturnableItem` ADD CONSTRAINT `TicketingOptionReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOption` ADD CONSTRAINT `TicketingOption_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOption` ADD CONSTRAINT `TicketingOption_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrder` ADD CONSTRAINT `TicketingOrder_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrder` ADD CONSTRAINT `TicketingOrder_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItem` ADD CONSTRAINT `TicketingOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `TicketingOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItem` ADD CONSTRAINT `TicketingOrderItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomField` ADD CONSTRAINT `TicketingTierCustomField_externalTicketingId_fkey` FOREIGN KEY (`externalTicketingId`) REFERENCES `ExternalTicketing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomField` ADD CONSTRAINT `TicketingTierCustomField_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldAssociation` ADD CONSTRAINT `TicketingTierCustomFieldAssociation_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldAssociation` ADD CONSTRAINT `TicketingTierCustomFieldAssociation_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldQuota` ADD CONSTRAINT `TicketingTierCustomFieldQuota_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldQuota` ADD CONSTRAINT `TicketingTierCustomFieldQuota_quotaId_fkey` FOREIGN KEY (`quotaId`) REFERENCES `TicketingQuota`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldReturnableItem` ADD CONSTRAINT `TicketingTierCustomFieldReturnableItem_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldReturnableItem` ADD CONSTRAINT `TicketingTierCustomFieldReturnableItem_returnableItemId_fkey` FOREIGN KEY (`returnableItemId`) REFERENCES `TicketingReturnableItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemOption` ADD CONSTRAINT `TicketingOrderItemOption_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `TicketingOrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOrderItemOption` ADD CONSTRAINT `TicketingOrderItemOption_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingCounter` ADD CONSTRAINT `TicketingCounter_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` ADD CONSTRAINT `VolunteerNotificationConfirmation_volunteerNotificationGrou_fkey` FOREIGN KEY (`volunteerNotificationGroupId`) REFERENCES `VolunteerNotificationGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` ADD CONSTRAINT `VolunteerNotificationConfirmation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerTeam` ADD CONSTRAINT `VolunteerTeam_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerTimeSlot` ADD CONSTRAINT `VolunteerTimeSlot_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerTimeSlot` ADD CONSTRAINT `VolunteerTimeSlot_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAssignment` ADD CONSTRAINT `VolunteerAssignment_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `VolunteerTimeSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAssignment` ADD CONSTRAINT `VolunteerAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAssignment` ADD CONSTRAINT `VolunteerAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationTeamAssignment` ADD CONSTRAINT `ApplicationTeamAssignment_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `EditionVolunteerApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationTeamAssignment` ADD CONSTRAINT `ApplicationTeamAssignment_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerComment` ADD CONSTRAINT `VolunteerComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerComment` ADD CONSTRAINT `VolunteerComment_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workshop` ADD CONSTRAINT `Workshop_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workshop` ADD CONSTRAINT `Workshop_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workshop` ADD CONSTRAINT `Workshop_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `WorkshopLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkshopFavorite` ADD CONSTRAINT `WorkshopFavorite_workshopId_fkey` FOREIGN KEY (`workshopId`) REFERENCES `Workshop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkshopFavorite` ADD CONSTRAINT `WorkshopFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkshopLocation` ADD CONSTRAINT `WorkshopLocation_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkshopLocation` ADD CONSTRAINT `WorkshopLocation_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `EditionZone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkshopLocation` ADD CONSTRAINT `WorkshopLocation_markerId_fkey` FOREIGN KEY (`markerId`) REFERENCES `EditionMarker`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_FavoriteEditions` ADD CONSTRAINT `_FavoriteEditions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_FavoriteEditions` ADD CONSTRAINT `_FavoriteEditions_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AttendingEditions` ADD CONSTRAINT `_AttendingEditions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AttendingEditions` ADD CONSTRAINT `_AttendingEditions_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


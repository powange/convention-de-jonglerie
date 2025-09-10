-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `pseudo` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NULL,
    `prenom` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `profilePicture` VARCHAR(191) NULL,
    `emailVerificationCode` VARCHAR(191) NULL,
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `verificationCodeExpiry` DATETIME(3) NULL,
    `isGlobalAdmin` BOOLEAN NOT NULL DEFAULT false,
    `phone` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_pseudo_key`(`pseudo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Convention` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `logo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `authorId` INTEGER NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConventionCollaborator` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `addedById` INTEGER NOT NULL,
    `canDeleteConvention` BOOLEAN NOT NULL DEFAULT false,
    `canEditConvention` BOOLEAN NOT NULL DEFAULT false,
    `canManageCollaborators` BOOLEAN NOT NULL DEFAULT false,
    `canArchiveConvention` BOOLEAN NOT NULL DEFAULT false,
    `canManageEditions` BOOLEAN NOT NULL DEFAULT false,
    `canManageVolunteers` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `ConventionCollaborator_conventionId_userId_key`(`conventionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollaboratorPermissionHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `targetUserId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `action` ENUM('CREATED', 'REMOVED', 'RIGHTS_UPDATED', 'ARCHIVED') NOT NULL,
    `previousRights` JSON NULL,
    `newRights` JSON NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Edition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `imageUrl` VARCHAR(191) NULL,
    `facebookUrl` VARCHAR(191) NULL,
    `instagramUrl` VARCHAR(191) NULL,
    `ticketingUrl` VARCHAR(191) NULL,
    `websiteUrl` VARCHAR(191) NULL,
    `acceptsPets` BOOLEAN NOT NULL DEFAULT false,
    `hasFoodTrucks` BOOLEAN NOT NULL DEFAULT false,
    `hasGym` BOOLEAN NOT NULL DEFAULT false,
    `hasKidsZone` BOOLEAN NOT NULL DEFAULT false,
    `hasTentCamping` BOOLEAN NOT NULL DEFAULT false,
    `hasTruckCamping` BOOLEAN NOT NULL DEFAULT false,
    `hasAccessibility` BOOLEAN NOT NULL DEFAULT false,
    `hasAerialSpace` BOOLEAN NOT NULL DEFAULT false,
    `hasCantine` BOOLEAN NOT NULL DEFAULT false,
    `hasConcert` BOOLEAN NOT NULL DEFAULT false,
    `hasFamilyCamping` BOOLEAN NOT NULL DEFAULT false,
    `hasFireSpace` BOOLEAN NOT NULL DEFAULT false,
    `hasGala` BOOLEAN NOT NULL DEFAULT false,
    `hasOpenStage` BOOLEAN NOT NULL DEFAULT false,
    `hasShowers` BOOLEAN NOT NULL DEFAULT false,
    `hasSlacklineSpace` BOOLEAN NOT NULL DEFAULT false,
    `hasToilets` BOOLEAN NOT NULL DEFAULT false,
    `hasWorkshops` BOOLEAN NOT NULL DEFAULT false,
    `hasAfjTokenPayment` BOOLEAN NOT NULL DEFAULT false,
    `hasCreditCardPayment` BOOLEAN NOT NULL DEFAULT false,
    `hasATM` BOOLEAN NOT NULL DEFAULT false,
    `hasLongShow` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `creatorId` INTEGER NOT NULL,
    `conventionId` INTEGER NOT NULL,
    `isOnline` BOOLEAN NOT NULL DEFAULT false,
    `askForDiet` BOOLEAN NOT NULL DEFAULT false,
    `askForAllergies` BOOLEAN NOT NULL DEFAULT false,
    `askForTimePreferences` BOOLEAN NOT NULL DEFAULT false,
    `askForTeamPreferences` BOOLEAN NOT NULL DEFAULT false,
    `teams` JSON NULL,
    `askForVehicle` BOOLEAN NOT NULL DEFAULT false,
    `askForCompanions` BOOLEAN NOT NULL DEFAULT false,
    `askForAvoidList` BOOLEAN NOT NULL DEFAULT false,
    `askForSkills` BOOLEAN NOT NULL DEFAULT false,
    `askForExperience` BOOLEAN NOT NULL DEFAULT false,
    `askForMinors` BOOLEAN NOT NULL DEFAULT false,
    `askForPets` BOOLEAN NOT NULL DEFAULT false,
    `volunteerExternalUrl` VARCHAR(191) NULL,
    `askForPresence` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionPost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EditionPost_editionId_fkey`(`editionId`),
    INDEX `EditionPost_userId_fkey`(`userId`),
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
CREATE TABLE `EditionVolunteerApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `motivation` TEXT NOT NULL,
    `diet` ENUM('NONE', 'VEGETARIAN', 'VEGAN', 'GLUTEN_FREE', 'OTHER') NOT NULL DEFAULT 'NONE',
    `allergies` TEXT NULL,
    `timePreferences` JSON NULL,
    `teamPreferences` TEXT NULL,
    `vehicle` ENUM('NONE', 'CAR', 'MOTORCYCLE', 'BICYCLE', 'OTHER') NOT NULL DEFAULT 'NONE',
    `companions` TEXT NULL,
    `avoidList` TEXT NULL,
    `skills` TEXT NULL,
    `experience` TEXT NULL,
    `minors` TEXT NULL,
    `pets` TEXT NULL,
    `presence` JSON NULL,
    `eventAvailability` JSON NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `adminNotes` TEXT NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EditionVolunteerApplication_editionId_userId_key`(`editionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolOffer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `departureDate` DATETIME(3) NOT NULL,
    `returnDate` DATETIME(3) NULL,
    `departureCity` VARCHAR(191) NOT NULL,
    `departureAddress` VARCHAR(191) NOT NULL,
    `availableSeats` INTEGER NOT NULL,
    `description` TEXT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `petsAllowed` BOOLEAN NOT NULL DEFAULT false,
    `smokingAllowed` BOOLEAN NOT NULL DEFAULT false,
    `pricePerSeat` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarpoolRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `departureDate` DATETIME(3) NOT NULL,
    `returnDate` DATETIME(3) NULL,
    `departureCity` VARCHAR(191) NOT NULL,
    `seatsNeeded` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `hasPets` BOOLEAN NOT NULL DEFAULT false,
    `canSmoke` BOOLEAN NOT NULL DEFAULT false,
    `maxBudget` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

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
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CarpoolBooking_carpoolOfferId_fkey`(`carpoolOfferId`),
    INDEX `CarpoolBooking_requesterId_fkey`(`requesterId`),
    INDEX `CarpoolBooking_requestId_fkey`(`requestId`),
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
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LostFoundItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `category` ENUM('CLOTHING', 'ELECTRONICS', 'JUGGLING_PROP', 'PERSONAL_ITEM', 'DOCUMENTS', 'OTHER') NOT NULL,
    `location` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `isReturned` BOOLEAN NOT NULL DEFAULT false,
    `returnedAt` DATETIME(3) NULL,
    `returnedToUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LostFoundComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lostFoundItemId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` ENUM('BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL_FEEDBACK') NOT NULL DEFAULT 'GENERAL_FEEDBACK',
    `userId` INTEGER NULL,
    `url` VARCHAR(191) NULL,
    `userAgent` VARCHAR(2000) NULL,
    `ip` VARCHAR(45) NULL,
    `status` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `adminNotes` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiErrorLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `method` VARCHAR(10) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `errorMessage` TEXT NOT NULL,
    `stack` TEXT NULL,
    `userId` INTEGER NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `body` TEXT NULL,
    `query` JSON NULL,
    `params` JSON NULL,
    `headers` JSON NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApiErrorLog_statusCode_idx`(`statusCode`),
    INDEX `ApiErrorLog_createdAt_idx`(`createdAt`),
    INDEX `ApiErrorLog_resolved_idx`(`resolved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'info',
    `category` VARCHAR(100) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `actionUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Notification_userId_idx`(`userId`),
    INDEX `Notification_isRead_idx`(`isRead`),
    INDEX `Notification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_FavoriteEditions` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_FavoriteEditions_AB_unique`(`A`, `B`),
    INDEX `_FavoriteEditions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollaboratorPermissionHistory` ADD CONSTRAINT `CollaboratorPermissionHistory_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPost` ADD CONSTRAINT `EditionPost_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPost` ADD CONSTRAINT `EditionPost_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPostComment` ADD CONSTRAINT `EditionPostComment_editionPostId_fkey` FOREIGN KEY (`editionPostId`) REFERENCES `EditionPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionPostComment` ADD CONSTRAINT `EditionPostComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `CarpoolPassenger` ADD CONSTRAINT `CarpoolPassenger_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_carpoolOfferId_fkey` FOREIGN KEY (`carpoolOfferId`) REFERENCES `CarpoolOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `CarpoolRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolBooking` ADD CONSTRAINT `CarpoolBooking_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundItem` ADD CONSTRAINT `LostFoundItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundItem` ADD CONSTRAINT `LostFoundItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundItem` ADD CONSTRAINT `LostFoundItem_returnedToUserId_fkey` FOREIGN KEY (`returnedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundComment` ADD CONSTRAINT `LostFoundComment_lostFoundItemId_fkey` FOREIGN KEY (`lostFoundItemId`) REFERENCES `LostFoundItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LostFoundComment` ADD CONSTRAINT `LostFoundComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApiErrorLog` ADD CONSTRAINT `ApiErrorLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_FavoriteEditions` ADD CONSTRAINT `_FavoriteEditions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_FavoriteEditions` ADD CONSTRAINT `_FavoriteEditions_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
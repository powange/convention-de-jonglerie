-- AlterTable
ALTER TABLE `Event` ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('PLANNED', 'PUBLISHED', 'OFFLINE', 'CANCELLED') NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN `timezone` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `allergies` TEXT NULL,
    ADD COLUMN `allergySeverity` ENUM('LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL') NULL,
    ADD COLUMN `dietaryPreference` ENUM('NONE', 'VEGETARIAN', 'VEGAN') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `emergencyContactName` VARCHAR(191) NULL,
    ADD COLUMN `emergencyContactPhone` VARCHAR(191) NULL,
    ADD COLUMN `pronouns` VARCHAR(191) NULL;

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
    INDEX `Notification_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organizer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Organizer_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionOrganizer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `editionId` INTEGER NOT NULL,
    `organizerId` INTEGER NOT NULL,
    `arrivalDateTime` VARCHAR(191) NULL,
    `departureDateTime` VARCHAR(191) NULL,
    `qrCodeToken` VARCHAR(191) NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EditionOrganizer_qrCodeToken_key`(`qrCodeToken`),
    INDEX `EditionOrganizer_editionId_idx`(`editionId`),
    INDEX `EditionOrganizer_organizerId_idx`(`organizerId`),
    UNIQUE INDEX `EditionOrganizer_editionId_organizerId_key`(`editionId`, `organizerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventVolunteerSettings` (
    `eventId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `open` BOOLEAN NOT NULL DEFAULT false,
    `pagePublic` BOOLEAN NOT NULL DEFAULT false,
    `mode` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
    `swapsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `organizersInTeams` BOOLEAN NOT NULL DEFAULT false,
    `planningPublished` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `externalUrl` VARCHAR(191) NULL,
    `setupStartDate` DATETIME(3) NULL,
    `teardownEndDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NULL,
    `askDiet` BOOLEAN NOT NULL DEFAULT false,
    `askAllergies` BOOLEAN NOT NULL DEFAULT false,
    `askTimePreferences` BOOLEAN NOT NULL DEFAULT false,
    `askTeamPreferences` BOOLEAN NOT NULL DEFAULT false,
    `askPets` BOOLEAN NOT NULL DEFAULT false,
    `askMinors` BOOLEAN NOT NULL DEFAULT false,
    `askVehicle` BOOLEAN NOT NULL DEFAULT false,
    `askCompanion` BOOLEAN NOT NULL DEFAULT false,
    `askAvoidList` BOOLEAN NOT NULL DEFAULT false,
    `askSkills` BOOLEAN NOT NULL DEFAULT false,
    `askExperience` BOOLEAN NOT NULL DEFAULT false,
    `askEmergencyContact` BOOLEAN NOT NULL DEFAULT false,
    `askSetup` BOOLEAN NOT NULL DEFAULT false,
    `askTeardown` BOOLEAN NOT NULL DEFAULT false,
    `autoAssignConstraints` JSON NULL,

    PRIMARY KEY (`eventId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EditionVolunteerApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `motivation` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `decidedAt` DATETIME(3) NULL,
    `userSnapshotPhone` VARCHAR(191) NULL,
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
    `qrCodeToken` VARCHAR(191) NULL,
    `entryValidated` BOOLEAN NOT NULL DEFAULT false,
    `entryValidatedAt` DATETIME(3) NULL,
    `entryValidatedBy` INTEGER NULL,
    `source` ENUM('APPLICATION', 'MANUAL') NOT NULL DEFAULT 'APPLICATION',
    `addedById` INTEGER NULL,
    `addedAt` DATETIME(3) NULL,

    UNIQUE INDEX `EditionVolunteerApplication_qrCodeToken_key`(`qrCodeToken`),
    INDEX `EditionVolunteerApplication_eventId_idx`(`eventId`),
    INDEX `EditionVolunteerApplication_status_idx`(`status`),
    INDEX `EditionVolunteerApplication_userId_fkey`(`userId`),
    INDEX `EditionVolunteerApplication_entryValidated_idx`(`entryValidated`),
    INDEX `EditionVolunteerApplication_source_idx`(`source`),
    INDEX `EditionVolunteerApplication_addedById_idx`(`addedById`),
    INDEX `EditionVolunteerApplication_qrCodeToken_idx`(`qrCodeToken`),
    UNIQUE INDEX `EditionVolunteerApplication_eventId_userId_key`(`eventId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerNotificationGroup` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` INTEGER NOT NULL,
    `senderId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `selectedTeams` JSON NULL,
    `recipientCount` INTEGER NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VolunteerNotificationGroup_eventId_idx`(`eventId`),
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
    `eventId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NOT NULL DEFAULT '#6b7280',
    `maxVolunteers` INTEGER NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `isAccessControlTeam` BOOLEAN NOT NULL DEFAULT false,
    `isMealValidationTeam` BOOLEAN NOT NULL DEFAULT false,
    `isFloatingTeam` BOOLEAN NOT NULL DEFAULT false,
    `isAutonomousTeam` BOOLEAN NOT NULL DEFAULT false,
    `coversSetup` BOOLEAN NOT NULL DEFAULT true,
    `coversEvent` BOOLEAN NOT NULL DEFAULT true,
    `coversTeardown` BOOLEAN NOT NULL DEFAULT true,
    `isVisibleToVolunteers` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerTeam_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerTimeSlot` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `startDateTime` DATETIME(3) NOT NULL,
    `endDateTime` DATETIME(3) NOT NULL,
    `maxVolunteers` INTEGER NOT NULL DEFAULT 1,
    `delayMinutes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerTimeSlot_eventId_idx`(`eventId`),
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
    `source` ENUM('MANUAL', 'AUTO') NOT NULL DEFAULT 'MANUAL',
    `reminderSentAt` DATETIME(3) NULL,

    INDEX `VolunteerAssignment_timeSlotId_idx`(`timeSlotId`),
    INDEX `VolunteerAssignment_userId_idx`(`userId`),
    INDEX `VolunteerAssignment_assignedById_idx`(`assignedById`),
    INDEX `VolunteerAssignment_source_idx`(`source`),
    UNIQUE INDEX `VolunteerAssignment_timeSlotId_userId_key`(`timeSlotId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerAutoAssignRun` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` INTEGER NOT NULL,
    `executedById` INTEGER NOT NULL,
    `executedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `mode` VARCHAR(191) NOT NULL,
    `constraints` JSON NOT NULL,
    `deletedAssignments` JSON NOT NULL,
    `createdAssignments` JSON NOT NULL,
    `deletedTeamLinks` JSON NOT NULL,
    `createdTeamLinks` JSON NOT NULL,
    `createdCount` INTEGER NOT NULL,
    `deletedCount` INTEGER NOT NULL,
    `empreinteApres` VARCHAR(191) NULL,
    `undoneAt` DATETIME(3) NULL,
    `undoneById` INTEGER NULL,

    INDEX `VolunteerAutoAssignRun_eventId_executedAt_idx`(`eventId`, `executedAt`),
    INDEX `VolunteerAutoAssignRun_executedById_idx`(`executedById`),
    INDEX `VolunteerAutoAssignRun_undoneById_idx`(`undoneById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerAutoAssignPlan` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `constraints` JSON NOT NULL,
    `assignments` JSON NOT NULL,
    `perimetre` JSON NOT NULL,
    `resultat` JSON NULL,
    `appliedAt` DATETIME(3) NULL,

    INDEX `VolunteerAutoAssignPlan_eventId_createdAt_idx`(`eventId`, `createdAt`),
    INDEX `VolunteerAutoAssignPlan_createdById_idx`(`createdById`),
    INDEX `VolunteerAutoAssignPlan_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationTeamAssignment` (
    `applicationId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `isLeader` BOOLEAN NOT NULL DEFAULT false,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` ENUM('MANUAL', 'AUTO') NOT NULL DEFAULT 'MANUAL',

    INDEX `ApplicationTeamAssignment_teamId_idx`(`teamId`),
    INDEX `ApplicationTeamAssignment_isLeader_idx`(`isLeader`),
    INDEX `ApplicationTeamAssignment_source_idx`(`source`),
    PRIMARY KEY (`applicationId`, `teamId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizerTeamAssignment` (
    `editionOrganizerId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `isLeader` BOOLEAN NOT NULL DEFAULT false,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrganizerTeamAssignment_teamId_idx`(`teamId`),
    INDEX `OrganizerTeamAssignment_isLeader_idx`(`isLeader`),
    PRIMARY KEY (`editionOrganizerId`, `teamId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizerSlotAssignment` (
    `editionOrganizerId` INTEGER NOT NULL,
    `timeSlotId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reminderSentAt` DATETIME(3) NULL,

    INDEX `OrganizerSlotAssignment_timeSlotId_idx`(`timeSlotId`),
    PRIMARY KEY (`editionOrganizerId`, `timeSlotId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `eventId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerComment_userId_idx`(`userId`),
    INDEX `VolunteerComment_eventId_idx`(`eventId`),
    UNIQUE INDEX `VolunteerComment_userId_eventId_key`(`userId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerSwapRequest` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` INTEGER NOT NULL,
    `requesterId` INTEGER NOT NULL,
    `targetId` INTEGER NOT NULL,
    `requesterAssignmentId` VARCHAR(191) NOT NULL,
    `targetAssignmentId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_PEER', 'PENDING_MANAGER', 'ACCEPTED', 'REFUSED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PEER',
    `peerRespondedAt` DATETIME(3) NULL,
    `decidedById` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VolunteerSwapRequest_eventId_status_idx`(`eventId`, `status`),
    INDEX `VolunteerSwapRequest_requesterId_idx`(`requesterId`),
    INDEX `VolunteerSwapRequest_targetId_idx`(`targetId`),
    INDEX `VolunteerSwapRequest_requesterAssignmentId_idx`(`requesterAssignmentId`),
    INDEX `VolunteerSwapRequest_targetAssignmentId_idx`(`targetAssignmentId`),
    INDEX `VolunteerSwapRequest_decidedById_idx`(`decidedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Organizer` ADD CONSTRAINT `Organizer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizer` ADD CONSTRAINT `EditionOrganizer_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizer` ADD CONSTRAINT `EditionOrganizer_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `Organizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventVolunteerSettings` ADD CONSTRAINT `EventVolunteerSettings_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerApplication` ADD CONSTRAINT `EditionVolunteerApplication_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` ADD CONSTRAINT `VolunteerNotificationConfirmation_volunteerNotificationGrou_fkey` FOREIGN KEY (`volunteerNotificationGroupId`) REFERENCES `VolunteerNotificationGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` ADD CONSTRAINT `VolunteerNotificationConfirmation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerTeam` ADD CONSTRAINT `VolunteerTeam_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerTimeSlot` ADD CONSTRAINT `VolunteerTimeSlot_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerTimeSlot` ADD CONSTRAINT `VolunteerTimeSlot_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAssignment` ADD CONSTRAINT `VolunteerAssignment_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `VolunteerTimeSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAssignment` ADD CONSTRAINT `VolunteerAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAssignment` ADD CONSTRAINT `VolunteerAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignRun` ADD CONSTRAINT `VolunteerAutoAssignRun_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignRun` ADD CONSTRAINT `VolunteerAutoAssignRun_executedById_fkey` FOREIGN KEY (`executedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignRun` ADD CONSTRAINT `VolunteerAutoAssignRun_undoneById_fkey` FOREIGN KEY (`undoneById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignPlan` ADD CONSTRAINT `VolunteerAutoAssignPlan_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignPlan` ADD CONSTRAINT `VolunteerAutoAssignPlan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationTeamAssignment` ADD CONSTRAINT `ApplicationTeamAssignment_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `EditionVolunteerApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationTeamAssignment` ADD CONSTRAINT `ApplicationTeamAssignment_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerTeamAssignment` ADD CONSTRAINT `OrganizerTeamAssignment_editionOrganizerId_fkey` FOREIGN KEY (`editionOrganizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerTeamAssignment` ADD CONSTRAINT `OrganizerTeamAssignment_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerSlotAssignment` ADD CONSTRAINT `OrganizerSlotAssignment_editionOrganizerId_fkey` FOREIGN KEY (`editionOrganizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerSlotAssignment` ADD CONSTRAINT `OrganizerSlotAssignment_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `VolunteerTimeSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerComment` ADD CONSTRAINT `VolunteerComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerComment` ADD CONSTRAINT `VolunteerComment_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_requesterAssignmentId_fkey` FOREIGN KEY (`requesterAssignmentId`) REFERENCES `VolunteerAssignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_targetAssignmentId_fkey` FOREIGN KEY (`targetAssignmentId`) REFERENCES `VolunteerAssignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


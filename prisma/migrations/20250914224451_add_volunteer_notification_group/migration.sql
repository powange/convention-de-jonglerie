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
    `confirmedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VolunteerNotificationConfirmation_userId_idx`(`userId`),
    UNIQUE INDEX `VolunteerNotificationConfirmation_volunteerNotificationGroup_key`(`volunteerNotificationGroupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` ADD CONSTRAINT `VolunteerNotificationConfirmation_volunteerNotificationGrou_fkey` FOREIGN KEY (`volunteerNotificationGroupId`) REFERENCES `VolunteerNotificationGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` ADD CONSTRAINT `VolunteerNotificationConfirmation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

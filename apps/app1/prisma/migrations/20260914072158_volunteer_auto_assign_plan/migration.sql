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
    `appliedAt` DATETIME(3) NULL,

    INDEX `VolunteerAutoAssignPlan_eventId_createdAt_idx`(`eventId`, `createdAt`),
    INDEX `VolunteerAutoAssignPlan_createdById_idx`(`createdById`),
    INDEX `VolunteerAutoAssignPlan_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignPlan` ADD CONSTRAINT `VolunteerAutoAssignPlan_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignPlan` ADD CONSTRAINT `VolunteerAutoAssignPlan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

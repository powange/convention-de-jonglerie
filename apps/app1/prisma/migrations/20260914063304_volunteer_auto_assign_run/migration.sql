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
    `undoneAt` DATETIME(3) NULL,
    `undoneById` INTEGER NULL,

    INDEX `VolunteerAutoAssignRun_eventId_executedAt_idx`(`eventId`, `executedAt`),
    INDEX `VolunteerAutoAssignRun_executedById_idx`(`executedById`),
    INDEX `VolunteerAutoAssignRun_undoneById_idx`(`undoneById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignRun` ADD CONSTRAINT `VolunteerAutoAssignRun_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignRun` ADD CONSTRAINT `VolunteerAutoAssignRun_executedById_fkey` FOREIGN KEY (`executedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerAutoAssignRun` ADD CONSTRAINT `VolunteerAutoAssignRun_undoneById_fkey` FOREIGN KEY (`undoneById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

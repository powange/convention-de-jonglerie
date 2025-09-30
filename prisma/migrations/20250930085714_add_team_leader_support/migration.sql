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

-- Migrate existing data from implicit many-to-many table
INSERT INTO `ApplicationTeamAssignment` (`applicationId`, `teamId`, `isLeader`, `assignedAt`)
SELECT
    `A` as applicationId,
    `B` as teamId,
    false as isLeader,
    NOW() as assignedAt
FROM `_EditionVolunteerApplicationToVolunteerTeam`;

-- Drop the old implicit many-to-many table
DROP TABLE `_EditionVolunteerApplicationToVolunteerTeam`;

-- AddForeignKey
ALTER TABLE `ApplicationTeamAssignment` ADD CONSTRAINT `ApplicationTeamAssignment_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `EditionVolunteerApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationTeamAssignment` ADD CONSTRAINT `ApplicationTeamAssignment_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
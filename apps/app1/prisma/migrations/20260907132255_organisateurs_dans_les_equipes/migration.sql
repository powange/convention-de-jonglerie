-- AlterTable
ALTER TABLE `EventVolunteerSettings` ADD COLUMN `organizersInTeams` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `OrganizerTeamAssignment` (
    `editionOrganizerId` INTEGER NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrganizerTeamAssignment_teamId_idx`(`teamId`),
    PRIMARY KEY (`editionOrganizerId`, `teamId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrganizerTeamAssignment` ADD CONSTRAINT `OrganizerTeamAssignment_editionOrganizerId_fkey` FOREIGN KEY (`editionOrganizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerTeamAssignment` ADD CONSTRAINT `OrganizerTeamAssignment_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

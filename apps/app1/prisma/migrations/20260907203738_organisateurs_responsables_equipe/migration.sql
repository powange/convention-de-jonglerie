-- AlterTable
ALTER TABLE `OrganizerTeamAssignment` ADD COLUMN `isLeader` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `OrganizerTeamAssignment_isLeader_idx` ON `OrganizerTeamAssignment`(`isLeader`);

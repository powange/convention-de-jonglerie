-- AlterTable
ALTER TABLE `ApplicationTeamAssignment` ADD COLUMN `source` ENUM('MANUAL', 'AUTO') NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX `ApplicationTeamAssignment_source_idx` ON `ApplicationTeamAssignment`(`source`);

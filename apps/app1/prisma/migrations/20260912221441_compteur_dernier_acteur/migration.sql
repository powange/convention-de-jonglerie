-- AlterTable
ALTER TABLE `TicketingCounter` ADD COLUMN `lastActorId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `TicketingCounter_lastActorId_idx` ON `TicketingCounter`(`lastActorId`);

-- AddForeignKey
ALTER TABLE `TicketingCounter` ADD CONSTRAINT `TicketingCounter_lastActorId_fkey` FOREIGN KEY (`lastActorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

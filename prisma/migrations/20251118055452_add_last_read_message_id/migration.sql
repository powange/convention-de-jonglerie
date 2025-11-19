-- AlterTable
ALTER TABLE `ConversationParticipant` ADD COLUMN `lastReadMessageId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `ConversationParticipant_lastReadMessageId_idx` ON `ConversationParticipant`(`lastReadMessageId`);

-- AddForeignKey
ALTER TABLE `ConversationParticipant` ADD CONSTRAINT `ConversationParticipant_lastReadMessageId_fkey` FOREIGN KEY (`lastReadMessageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

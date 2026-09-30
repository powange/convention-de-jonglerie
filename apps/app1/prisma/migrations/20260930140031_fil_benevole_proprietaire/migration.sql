-- AlterTable
ALTER TABLE `Conversation` ADD COLUMN `volunteerId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Conversation_volunteerId_idx` ON `Conversation`(`volunteerId`);

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

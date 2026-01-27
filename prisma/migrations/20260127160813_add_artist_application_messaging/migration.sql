/*
  Warnings:

  - A unique constraint covering the columns `[showApplicationId]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Conversation` ADD COLUMN `showApplicationId` INTEGER NULL,
    MODIFY `type` ENUM('TEAM_GROUP', 'TEAM_LEADER_PRIVATE', 'VOLUNTEER_TO_ORGANIZERS', 'ORGANIZERS_GROUP', 'PRIVATE', 'ARTIST_APPLICATION') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Conversation_showApplicationId_key` ON `Conversation`(`showApplicationId`);

-- CreateIndex
CREATE INDEX `Conversation_showApplicationId_idx` ON `Conversation`(`showApplicationId`);

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_showApplicationId_fkey` FOREIGN KEY (`showApplicationId`) REFERENCES `ShowApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

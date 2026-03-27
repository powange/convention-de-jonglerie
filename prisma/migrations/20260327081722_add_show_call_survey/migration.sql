/*
  Warnings:

  - A unique constraint covering the columns `[surveyToken]` on the table `EditionShowCall` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `EditionShowCall` ADD COLUMN `surveyOpen` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `surveyToken` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ShowCallSurveyVote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showCallId` INTEGER NOT NULL,
    `applicationId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShowCallSurveyVote_showCallId_idx`(`showCallId`),
    INDEX `ShowCallSurveyVote_applicationId_idx`(`applicationId`),
    INDEX `ShowCallSurveyVote_userId_idx`(`userId`),
    UNIQUE INDEX `ShowCallSurveyVote_showCallId_applicationId_userId_key`(`showCallId`, `applicationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `EditionShowCall_surveyToken_key` ON `EditionShowCall`(`surveyToken`);

-- AddForeignKey
ALTER TABLE `ShowCallSurveyVote` ADD CONSTRAINT `ShowCallSurveyVote_showCallId_fkey` FOREIGN KEY (`showCallId`) REFERENCES `EditionShowCall`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowCallSurveyVote` ADD CONSTRAINT `ShowCallSurveyVote_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `ShowApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowCallSurveyVote` ADD CONSTRAINT `ShowCallSurveyVote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

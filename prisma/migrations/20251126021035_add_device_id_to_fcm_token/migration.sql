-- AlterTable
ALTER TABLE `FcmToken` ADD COLUMN `deviceId` VARCHAR(100) NULL;

-- CreateIndex
CREATE INDEX `FcmToken_deviceId_idx` ON `FcmToken`(`deviceId`);

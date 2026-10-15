-- AlterTable
ALTER TABLE `User` ADD COLUMN `facebookId` VARCHAR(191) NULL,
    ADD COLUMN `googleId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_googleId_key` ON `User`(`googleId`);

-- CreateIndex
CREATE UNIQUE INDEX `User_facebookId_key` ON `User`(`facebookId`);


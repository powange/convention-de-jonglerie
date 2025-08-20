-- DropForeignKey
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `ConventionCollaborator` DROP FOREIGN KEY `ConventionCollaborator_addedById_fkey`;

-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_conventionId_fkey`;

-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_creatorId_fkey`;

-- CreateTable
CREATE TABLE `Feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('BUG', 'SUGGESTION', 'GENERAL', 'COMPLAINT') NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `email` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `userAgent` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `adminNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Feedback_resolved_idx`(`resolved` ASC),
    INDEX `Feedback_type_idx`(`type` ASC),
    INDEX `Feedback_userId_fkey`(`userId` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


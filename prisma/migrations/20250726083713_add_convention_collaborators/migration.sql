-- CreateTable
CREATE TABLE `ConventionCollaborator` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conventionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `canEdit` BOOLEAN NOT NULL DEFAULT true,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `addedById` INTEGER NOT NULL,

    UNIQUE INDEX `ConventionCollaborator_conventionId_userId_key`(`conventionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

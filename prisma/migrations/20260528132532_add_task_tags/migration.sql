-- CreateTable
CREATE TABLE `TaskTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskGroupId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaskTag_taskGroupId_idx`(`taskGroupId`),
    INDEX `TaskTag_taskGroupId_displayOrder_idx`(`taskGroupId`, `displayOrder`),
    UNIQUE INDEX `TaskTag_taskGroupId_name_key`(`taskGroupId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskTagAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskTagAssignment_taskId_idx`(`taskId`),
    INDEX `TaskTagAssignment_tagId_idx`(`tagId`),
    UNIQUE INDEX `TaskTagAssignment_taskId_tagId_key`(`taskId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaskTag` ADD CONSTRAINT `TaskTag_taskGroupId_fkey` FOREIGN KEY (`taskGroupId`) REFERENCES `TaskGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskTagAssignment` ADD CONSTRAINT `TaskTagAssignment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskTagAssignment` ADD CONSTRAINT `TaskTagAssignment_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `TaskTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

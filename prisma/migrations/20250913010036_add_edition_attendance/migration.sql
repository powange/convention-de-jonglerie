-- CreateTable
CREATE TABLE `_AttendingEditions` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_AttendingEditions_AB_unique`(`A`, `B`),
    INDEX `_AttendingEditions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_AttendingEditions` ADD CONSTRAINT `_AttendingEditions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AttendingEditions` ADD CONSTRAINT `_AttendingEditions_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

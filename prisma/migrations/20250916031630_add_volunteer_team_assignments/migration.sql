-- CreateTable
CREATE TABLE `_EditionVolunteerApplicationToVolunteerTeam` (
    `A` INTEGER NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_EditionVolunteerApplicationToVolunteerTeam_AB_unique`(`A`, `B`),
    INDEX `_EditionVolunteerApplicationToVolunteerTeam_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_EditionVolunteerApplicationToVolunteerTeam` ADD CONSTRAINT `_EditionVolunteerApplicationToVolunteerTeam_A_fkey` FOREIGN KEY (`A`) REFERENCES `EditionVolunteerApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_EditionVolunteerApplicationToVolunteerTeam` ADD CONSTRAINT `_EditionVolunteerApplicationToVolunteerTeam_B_fkey` FOREIGN KEY (`B`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `OrganizerSlotAssignment` (
    `editionOrganizerId` INTEGER NOT NULL,
    `timeSlotId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrganizerSlotAssignment_timeSlotId_idx`(`timeSlotId`),
    PRIMARY KEY (`editionOrganizerId`, `timeSlotId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrganizerSlotAssignment` ADD CONSTRAINT `OrganizerSlotAssignment_editionOrganizerId_fkey` FOREIGN KEY (`editionOrganizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizerSlotAssignment` ADD CONSTRAINT `OrganizerSlotAssignment_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `VolunteerTimeSlot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

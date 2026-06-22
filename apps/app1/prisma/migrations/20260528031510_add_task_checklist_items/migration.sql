-- DropForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` DROP FOREIGN KEY `EditionOrganizerReturnableItem_editionId_fkey`;

-- DropForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` DROP FOREIGN KEY `EditionOrganizerReturnableItem_organizerId_fkey`;

-- DropForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` DROP FOREIGN KEY `EditionVolunteerReturnableItem_editionId_fkey`;

-- DropForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` DROP FOREIGN KEY `EditionVolunteerReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` DROP FOREIGN KEY `EditionVolunteerReturnableItem_teamId_fkey`;

-- DropForeignKey
ALTER TABLE `ShowHandoutItem` DROP FOREIGN KEY `ShowReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `ShowHandoutItem` DROP FOREIGN KEY `ShowReturnableItem_showId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingHandoutItem` DROP FOREIGN KEY `TicketingReturnableItem_editionId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingOptionHandoutItem` DROP FOREIGN KEY `TicketingOptionReturnableItem_optionId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingOptionHandoutItem` DROP FOREIGN KEY `TicketingOptionReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingTierCustomFieldHandoutItem` DROP FOREIGN KEY `TicketingTierCustomFieldReturnableItem_customFieldId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingTierCustomFieldHandoutItem` DROP FOREIGN KEY `TicketingTierCustomFieldReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingTierHandoutItem` DROP FOREIGN KEY `TicketingTierReturnableItem_returnableItemId_fkey`;

-- DropForeignKey
ALTER TABLE `TicketingTierHandoutItem` DROP FOREIGN KEY `TicketingTierReturnableItem_tierId_fkey`;

-- DropForeignKey
ALTER TABLE `VolunteerMealHandoutItem` DROP FOREIGN KEY `VolunteerMealReturnableItem_mealId_fkey`;

-- DropForeignKey
ALTER TABLE `VolunteerMealHandoutItem` DROP FOREIGN KEY `VolunteerMealReturnableItem_returnableItemId_fkey`;

-- CreateTable
CREATE TABLE `TaskChecklistItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaskChecklistItem_taskId_idx`(`taskId`),
    INDEX `TaskChecklistItem_taskId_displayOrder_idx`(`taskId`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ShowHandoutItem` ADD CONSTRAINT `ShowHandoutItem_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowHandoutItem` ADD CONSTRAINT `ShowHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealHandoutItem` ADD CONSTRAINT `VolunteerMealHandoutItem_mealId_fkey` FOREIGN KEY (`mealId`) REFERENCES `VolunteerMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerMealHandoutItem` ADD CONSTRAINT `VolunteerMealHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskChecklistItem` ADD CONSTRAINT `TaskChecklistItem_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingHandoutItem` ADD CONSTRAINT `TicketingHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` ADD CONSTRAINT `EditionVolunteerHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` ADD CONSTRAINT `EditionVolunteerHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionVolunteerHandoutItem` ADD CONSTRAINT `EditionVolunteerHandoutItem_teamId_fkey` FOREIGN KEY (`teamId`) REFERENCES `VolunteerTeam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` ADD CONSTRAINT `EditionOrganizerHandoutItem_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` ADD CONSTRAINT `EditionOrganizerHandoutItem_organizerId_fkey` FOREIGN KEY (`organizerId`) REFERENCES `EditionOrganizer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierHandoutItem` ADD CONSTRAINT `TicketingTierHandoutItem_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `TicketingTier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierHandoutItem` ADD CONSTRAINT `TicketingTierHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionHandoutItem` ADD CONSTRAINT `TicketingOptionHandoutItem_optionId_fkey` FOREIGN KEY (`optionId`) REFERENCES `TicketingOption`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingOptionHandoutItem` ADD CONSTRAINT `TicketingOptionHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldHandoutItem` ADD CONSTRAINT `TicketingTierCustomFieldHandoutItem_customFieldId_fkey` FOREIGN KEY (`customFieldId`) REFERENCES `TicketingTierCustomField`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketingTierCustomFieldHandoutItem` ADD CONSTRAINT `TicketingTierCustomFieldHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `EditionOrganizerHandoutItem` RENAME INDEX `EditionOrganizerReturnableItem_editionId_idx` TO `EditionOrganizerHandoutItem_editionId_idx`;

-- RenameIndex
ALTER TABLE `EditionOrganizerHandoutItem` RENAME INDEX `EditionOrganizerReturnableItem_editionId_returnableItemId_or_key` TO `EditionOrganizerHandoutItem_editionId_handoutItemId_organize_key`;

-- RenameIndex
ALTER TABLE `EditionOrganizerHandoutItem` RENAME INDEX `EditionOrganizerReturnableItem_organizerId_idx` TO `EditionOrganizerHandoutItem_organizerId_idx`;

-- RenameIndex
ALTER TABLE `EditionOrganizerHandoutItem` RENAME INDEX `EditionOrganizerReturnableItem_returnableItemId_idx` TO `EditionOrganizerHandoutItem_handoutItemId_idx`;

-- RenameIndex
ALTER TABLE `EditionVolunteerHandoutItem` RENAME INDEX `EditionVolunteerReturnableItem_editionId_idx` TO `EditionVolunteerHandoutItem_editionId_idx`;

-- RenameIndex
ALTER TABLE `EditionVolunteerHandoutItem` RENAME INDEX `EditionVolunteerReturnableItem_editionId_returnableItemId_te_key` TO `EditionVolunteerHandoutItem_editionId_handoutItemId_teamId_key`;

-- RenameIndex
ALTER TABLE `EditionVolunteerHandoutItem` RENAME INDEX `EditionVolunteerReturnableItem_returnableItemId_idx` TO `EditionVolunteerHandoutItem_handoutItemId_idx`;

-- RenameIndex
ALTER TABLE `EditionVolunteerHandoutItem` RENAME INDEX `EditionVolunteerReturnableItem_teamId_idx` TO `EditionVolunteerHandoutItem_teamId_idx`;

-- RenameIndex
ALTER TABLE `ShowHandoutItem` RENAME INDEX `ShowReturnableItem_returnableItemId_idx` TO `ShowHandoutItem_handoutItemId_idx`;

-- RenameIndex
ALTER TABLE `ShowHandoutItem` RENAME INDEX `ShowReturnableItem_showId_idx` TO `ShowHandoutItem_showId_idx`;

-- RenameIndex
ALTER TABLE `ShowHandoutItem` RENAME INDEX `ShowReturnableItem_showId_returnableItemId_key` TO `ShowHandoutItem_showId_handoutItemId_key`;

-- RenameIndex
ALTER TABLE `TicketingHandoutItem` RENAME INDEX `TicketingReturnableItem_editionId_idx` TO `TicketingHandoutItem_editionId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOptionHandoutItem` RENAME INDEX `TicketingOptionReturnableItem_optionId_idx` TO `TicketingOptionHandoutItem_optionId_idx`;

-- RenameIndex
ALTER TABLE `TicketingOptionHandoutItem` RENAME INDEX `TicketingOptionReturnableItem_optionId_returnableItemId_key` TO `TicketingOptionHandoutItem_optionId_handoutItemId_key`;

-- RenameIndex
ALTER TABLE `TicketingOptionHandoutItem` RENAME INDEX `TicketingOptionReturnableItem_returnableItemId_idx` TO `TicketingOptionHandoutItem_handoutItemId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierCustomFieldHandoutItem` RENAME INDEX `TicketingTierCustomFieldReturnableItem_customFieldId_idx` TO `TicketingTierCustomFieldHandoutItem_customFieldId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierCustomFieldHandoutItem` RENAME INDEX `TicketingTierCustomFieldReturnableItem_customFieldId_returna_key` TO `TicketingTierCustomFieldHandoutItem_customFieldId_handoutIte_key`;

-- RenameIndex
ALTER TABLE `TicketingTierCustomFieldHandoutItem` RENAME INDEX `TicketingTierCustomFieldReturnableItem_returnableItemId_idx` TO `TicketingTierCustomFieldHandoutItem_handoutItemId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierHandoutItem` RENAME INDEX `TicketingTierReturnableItem_returnableItemId_idx` TO `TicketingTierHandoutItem_handoutItemId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierHandoutItem` RENAME INDEX `TicketingTierReturnableItem_tierId_idx` TO `TicketingTierHandoutItem_tierId_idx`;

-- RenameIndex
ALTER TABLE `TicketingTierHandoutItem` RENAME INDEX `TicketingTierReturnableItem_tierId_returnableItemId_key` TO `TicketingTierHandoutItem_tierId_handoutItemId_key`;

-- RenameIndex
ALTER TABLE `VolunteerMealHandoutItem` RENAME INDEX `VolunteerMealReturnableItem_mealId_idx` TO `VolunteerMealHandoutItem_mealId_idx`;

-- RenameIndex
ALTER TABLE `VolunteerMealHandoutItem` RENAME INDEX `VolunteerMealReturnableItem_mealId_returnableItemId_key` TO `VolunteerMealHandoutItem_mealId_handoutItemId_key`;

-- RenameIndex
ALTER TABLE `VolunteerMealHandoutItem` RENAME INDEX `VolunteerMealReturnableItem_returnableItemId_idx` TO `VolunteerMealHandoutItem_handoutItemId_idx`;

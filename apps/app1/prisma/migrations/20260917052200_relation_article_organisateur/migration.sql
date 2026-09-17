-- AddForeignKey
ALTER TABLE `EditionOrganizerHandoutItem` ADD CONSTRAINT `EditionOrganizerHandoutItem_handoutItemId_fkey` FOREIGN KEY (`handoutItemId`) REFERENCES `TicketingHandoutItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Renommage cohérent « Returnable » → « Handout » suite au renaming UI
-- « Articles à restituer » → « Articles à remettre ».

-- 1. Rename tables
RENAME TABLE `TicketingReturnableItem` TO `TicketingHandoutItem`;
RENAME TABLE `EditionVolunteerReturnableItem` TO `EditionVolunteerHandoutItem`;
RENAME TABLE `EditionOrganizerReturnableItem` TO `EditionOrganizerHandoutItem`;
RENAME TABLE `TicketingTierReturnableItem` TO `TicketingTierHandoutItem`;
RENAME TABLE `TicketingOptionReturnableItem` TO `TicketingOptionHandoutItem`;
RENAME TABLE `TicketingTierCustomFieldReturnableItem` TO `TicketingTierCustomFieldHandoutItem`;
RENAME TABLE `ShowReturnableItem` TO `ShowHandoutItem`;
RENAME TABLE `VolunteerMealReturnableItem` TO `VolunteerMealHandoutItem`;

-- 2. Rename the boolean flag on Edition
ALTER TABLE `Edition` RENAME COLUMN `ticketingReturnableItemsEnabled` TO `ticketingHandoutItemsEnabled`;

-- 3. Rename `returnableItemId` foreign key columns on each association table
ALTER TABLE `EditionVolunteerHandoutItem`        RENAME COLUMN `returnableItemId` TO `handoutItemId`;
ALTER TABLE `EditionOrganizerHandoutItem`        RENAME COLUMN `returnableItemId` TO `handoutItemId`;
ALTER TABLE `TicketingTierHandoutItem`           RENAME COLUMN `returnableItemId` TO `handoutItemId`;
ALTER TABLE `TicketingOptionHandoutItem`         RENAME COLUMN `returnableItemId` TO `handoutItemId`;
ALTER TABLE `TicketingTierCustomFieldHandoutItem` RENAME COLUMN `returnableItemId` TO `handoutItemId`;
ALTER TABLE `ShowHandoutItem`                    RENAME COLUMN `returnableItemId` TO `handoutItemId`;
ALTER TABLE `VolunteerMealHandoutItem`           RENAME COLUMN `returnableItemId` TO `handoutItemId`;

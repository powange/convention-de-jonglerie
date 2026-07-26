-- AlterTable
ALTER TABLE `EditionArtistHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `EditionOrganizerHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `EditionVolunteerHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `ShowHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `TicketingOptionHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `TicketingTierCustomFieldHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `TicketingTierHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `VolunteerMealHandoutItem` ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

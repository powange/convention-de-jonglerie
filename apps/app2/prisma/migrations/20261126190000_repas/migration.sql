-- Repas (lot 7). Le DROP retire une colonne `eventId` superflue de VolunteerMeal, inventée par
-- `prisma format` au lot 4 quand cette table dormante avait perdu sa relation à l'événement ; la
-- table est VIDE partout (aucun repas ne pouvait être créé dans Flowvent avant ce lot).

-- DropForeignKey
ALTER TABLE `VolunteerMeal` DROP FOREIGN KEY `VolunteerMeal_eventId_fkey`;

-- DropIndex
DROP INDEX `VolunteerMeal_eventId_fkey` ON `VolunteerMeal`;

-- AlterTable
ALTER TABLE `VolunteerMeal` DROP COLUMN `eventId`;

-- AddForeignKey
ALTER TABLE `VolunteerMeal` ADD CONSTRAINT `VolunteerMeal_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


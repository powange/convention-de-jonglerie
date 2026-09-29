-- Supprimer un compte échouait en 500 (P2003) dès que l'utilisateur était cité par l'une de ces
-- cinq relations. Toutes étaient OBLIGATOIRES et sans action de suppression : Prisma applique alors
-- `Restrict`, et la base refusait. Les six autres relations vers `User` du schéma sont facultatives
-- et retombent d'elles-mêmes sur `SET NULL` — elles n'ont jamais rien bloqué.
--
-- Deux traitements, selon ce que la ligne raconte :
--
--   * les ACCUSÉS DE LECTURE (les deux `...Confirmation`) sont une ligne par destinataire. Le
--     destinataire parti, elle ne dit plus rien : CASCADE.
--   * les TRACES D'ACTION — qui a envoyé la notification, qui a ajouté cet organisateur — doivent
--     survivre à leur auteur. Le message a été reçu, l'organisateur a bien été ajouté : effacer ces
--     faits avec le compte réécrirait l'histoire de l'édition. D'où la colonne rendue facultative
--     et SET NULL.
--
-- ⚠️ Rien n'est détruit : aucune colonne supprimée, aucune ligne. Les trois `MODIFY` élargissent le
-- domaine des colonnes (NOT NULL → NULL), ce qui ne peut pas invalider une valeur existante.

-- DropForeignKey
ALTER TABLE `ArtistNotificationConfirmation` DROP FOREIGN KEY `ArtistNotificationConfirmation_userId_fkey`;

-- DropForeignKey
ALTER TABLE `ArtistNotificationGroup` DROP FOREIGN KEY `ArtistNotificationGroup_senderId_fkey`;

-- DropForeignKey
ALTER TABLE `ConventionOrganizer` DROP FOREIGN KEY `ConventionOrganizer_addedById_fkey`;

-- DropForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` DROP FOREIGN KEY `VolunteerNotificationConfirmation_userId_fkey`;

-- DropForeignKey
ALTER TABLE `VolunteerNotificationGroup` DROP FOREIGN KEY `VolunteerNotificationGroup_senderId_fkey`;

-- AlterTable
ALTER TABLE `ArtistNotificationGroup` MODIFY `senderId` INTEGER NULL;

-- AlterTable
ALTER TABLE `ConventionOrganizer` MODIFY `addedById` INTEGER NULL;

-- AlterTable
ALTER TABLE `VolunteerNotificationGroup` MODIFY `senderId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `ArtistNotificationGroup` ADD CONSTRAINT `ArtistNotificationGroup_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArtistNotificationConfirmation` ADD CONSTRAINT `ArtistNotificationConfirmation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionOrganizer` ADD CONSTRAINT `ConventionOrganizer_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationGroup` ADD CONSTRAINT `VolunteerNotificationGroup_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VolunteerNotificationConfirmation` ADD CONSTRAINT `VolunteerNotificationConfirmation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

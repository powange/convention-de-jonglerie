-- Rappel par courriel avant la fin d'un abonnement : la fin de période déjà rappelée, pour n'envoyer
-- qu'un rappel par période. Additive : aucune donnée supprimée.
-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `endReminderFor` DATETIME(3) NULL;


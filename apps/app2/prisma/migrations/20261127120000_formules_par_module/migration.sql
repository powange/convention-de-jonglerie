-- Formules d'abonnement par module (Solo, Duo, Intégral). Les abonnements existants passent en
-- Intégral par la valeur par défaut : ils gardent tout ce qu'ils avaient. Aucune donnée supprimée.
ALTER TABLE `Subscription` ADD COLUMN `formule` VARCHAR(191) NOT NULL DEFAULT 'integral',
    ADD COLUMN `modules` JSON NULL;

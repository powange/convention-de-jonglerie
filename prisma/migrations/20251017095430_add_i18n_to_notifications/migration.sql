-- Migration sûre : Renommer les colonnes existantes
-- Étape 1 : Ajouter les nouveaux champs pour le système de traduction
ALTER TABLE `Notification`
    ADD COLUMN `titleKey` VARCHAR(191) NULL,
    ADD COLUMN `messageKey` VARCHAR(191) NULL,
    ADD COLUMN `translationParams` JSON NULL,
    ADD COLUMN `actionTextKey` VARCHAR(191) NULL;

-- Étape 2 : Renommer les anciennes colonnes (préserve toutes les données !)
ALTER TABLE `Notification`
    CHANGE COLUMN `title` `titleText` TEXT NULL,
    CHANGE COLUMN `message` `messageText` TEXT NULL;

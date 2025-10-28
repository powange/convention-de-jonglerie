/*
  Warnings:

  - You are about to drop the column `phase` on the `VolunteerMeal` table. All the data in the column will be lost.

*/

-- Étape 1 : Ajouter la nouvelle colonne phases avec une valeur par défaut
ALTER TABLE `VolunteerMeal` ADD COLUMN `phases` JSON NOT NULL DEFAULT ('[]');

-- Étape 2 : Copier les données de phase vers phases (en convertissant en JSON array)
UPDATE `VolunteerMeal`
SET `phases` = JSON_ARRAY(`phase`)
WHERE `phase` IS NOT NULL;

-- Étape 3 : Supprimer l'ancienne colonne phase
ALTER TABLE `VolunteerMeal` DROP COLUMN `phase`;

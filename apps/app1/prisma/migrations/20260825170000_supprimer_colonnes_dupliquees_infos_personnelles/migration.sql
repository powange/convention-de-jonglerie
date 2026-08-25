-- Suppression des colonnes dupliquées : régime, allergies et contact d'urgence ne vivent plus
-- que sur `User`.
--
-- MIGRATION DESTRUCTRICE ET IRRÉVERSIBLE.
--
-- Elle n'est lancée qu'après vérification sur les données de production : les 63 valeurs
-- portées par une fiche étaient toutes présentes sur le profil correspondant, aucune manquante.
-- Le compte était figé, les colonnes ne recevant plus rien depuis le déploiement précédent.
--
--   candidatures : régime 15/15, allergies 9/9, contact d'urgence 26/26
--   artistes     : régime 7/7, allergies 6/6
--   organisateurs: aucune valeur
--
-- La requête de contrôle, qui interrogeait ces colonnes, a été supprimée avec elles : elle
-- n'aurait plus rien à interroger. Son résultat est reproduit ci-dessus, et c'est lui qui
-- justifie cette migration — pas la seule confiance dans la reprise.

ALTER TABLE `EditionVolunteerApplication`
  DROP COLUMN `dietaryPreference`,
  DROP COLUMN `allergies`,
  DROP COLUMN `allergySeverity`,
  DROP COLUMN `emergencyContactName`,
  DROP COLUMN `emergencyContactPhone`;

ALTER TABLE `EditionArtist`
  DROP COLUMN `dietaryPreference`,
  DROP COLUMN `allergies`,
  DROP COLUMN `allergySeverity`;

ALTER TABLE `EditionOrganizer`
  DROP COLUMN `dietaryPreference`,
  DROP COLUMN `allergies`,
  DROP COLUMN `allergySeverity`;

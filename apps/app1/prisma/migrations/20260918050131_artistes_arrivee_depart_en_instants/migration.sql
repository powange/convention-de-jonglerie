-- Arrivée et départ d'un artiste : de la chaîne libre à l'instant.
--
-- Les deux colonnes stockaient la valeur brute d'un champ `datetime-local` — « 2025-10-31T15:00 »,
-- sans fuseau. Impossible à trier, à comparer, ou à afficher à l'heure du lieu : la carte de
-- l'artiste affichait d'ailleurs cette chaîne telle quelle.
--
-- Une heure ainsi saisie veut dire « 15 h SUR PLACE ». La relire comme 15 h UTC décalerait chaque
-- arrivée d'une à deux heures. Le rattrapage ancre donc chaque valeur au fuseau de son édition.

-- 1. Les nouvelles colonnes, à côté des anciennes : rien n'est encore perdu.
ALTER TABLE `EditionArtist`
  ADD COLUMN `arrivalAt` DATETIME(3) NULL,
  ADD COLUMN `departureAt` DATETIME(3) NULL;

-- 2. Le rattrapage des lignes existantes.
--
-- Le `COALESCE` extérieur est un garde-fou : `CONVERT_TZ` rend NULL quand la base n'a pas ses
-- tables de fuseaux — elles sont présentes ici, mais rien ne le garantit ailleurs — ou quand le
-- fuseau enregistré est inconnu. Sans lui, la conversion effacerait silencieusement les dates.
-- Le repli à +01:00 est l'heure d'hiver européenne : approximatif, mais il préserve la donnée.
--
-- `Europe/Paris` pour les éditions qui ne déclarent aucun fuseau : c'est le cas de la seule
-- édition concernée, terminée depuis un an, et le fuseau dominant des conventions du site.
UPDATE `EditionArtist` a
  JOIN `Edition` e ON e.id = a.editionId
SET
  a.`arrivalAt` = COALESCE(
    CONVERT_TZ(
      STR_TO_DATE(a.`arrivalDateTime`, '%Y-%m-%dT%H:%i'),
      COALESCE(NULLIF(e.`timezone`, ''), 'Europe/Paris'),
      'UTC'
    ),
    CONVERT_TZ(STR_TO_DATE(a.`arrivalDateTime`, '%Y-%m-%dT%H:%i'), '+01:00', '+00:00')
  ),
  a.`departureAt` = COALESCE(
    CONVERT_TZ(
      STR_TO_DATE(a.`departureDateTime`, '%Y-%m-%dT%H:%i'),
      COALESCE(NULLIF(e.`timezone`, ''), 'Europe/Paris'),
      'UTC'
    ),
    CONVERT_TZ(STR_TO_DATE(a.`departureDateTime`, '%Y-%m-%dT%H:%i'), '+01:00', '+00:00')
  )
WHERE a.`arrivalDateTime` IS NOT NULL OR a.`departureDateTime` IS NOT NULL;

-- 3. Les colonnes texte disparaissent, les nouvelles prennent leur nom.
ALTER TABLE `EditionArtist`
  DROP COLUMN `arrivalDateTime`,
  DROP COLUMN `departureDateTime`;

ALTER TABLE `EditionArtist`
  CHANGE COLUMN `arrivalAt` `arrivalDateTime` DATETIME(3) NULL,
  CHANGE COLUMN `departureAt` `departureDateTime` DATETIME(3) NULL;

-- Formules à la TAILLE (rapport « Tarifs de Flowvent », version 2, 26/11/2026) : les formules par
-- module (solo, duo, integral) laissent place à association, festival et grand, avec des plafonds
-- (shared/formules.ts) et tous les modules partout.

-- L'archivage d'un événement : lecture seule, hors du compteur d'événements en cours.
ALTER TABLE `Event` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- Les abonnements passent à la formule de prix équivalent (décision du 26/11) :
-- solo → association, duo et integral → festival. Même échéance, sans prorata (paiement simulé).
UPDATE `Subscription` SET `formule` = CASE `formule`
  WHEN 'solo' THEN 'association'
  WHEN 'duo' THEN 'festival'
  WHEN 'integral' THEN 'festival'
  ELSE `formule`
END;

-- Les codes promo visent les nouvelles formules selon la même correspondance (doublons retirés).
UPDATE `PromoCode`
SET `formules` = JSON_ARRAY('association', 'festival')
WHERE `formules` IS NOT NULL
  AND JSON_CONTAINS(`formules`, '"solo"')
  AND (JSON_CONTAINS(`formules`, '"duo"') OR JSON_CONTAINS(`formules`, '"integral"'));
UPDATE `PromoCode`
SET `formules` = JSON_ARRAY('association')
WHERE `formules` IS NOT NULL
  AND JSON_CONTAINS(`formules`, '"solo"')
  AND NOT JSON_CONTAINS(`formules`, '"duo"') AND NOT JSON_CONTAINS(`formules`, '"integral"');
UPDATE `PromoCode`
SET `formules` = JSON_ARRAY('festival')
WHERE `formules` IS NOT NULL
  AND NOT JSON_CONTAINS(`formules`, '"solo"')
  AND (JSON_CONTAINS(`formules`, '"duo"') OR JSON_CONTAINS(`formules`, '"integral"'));

-- La liste des modules choisis n'a plus d'objet : toutes les formules les comprennent tous.
ALTER TABLE `Subscription` DROP COLUMN `modules`,
    MODIFY `formule` VARCHAR(191) NOT NULL DEFAULT 'association';

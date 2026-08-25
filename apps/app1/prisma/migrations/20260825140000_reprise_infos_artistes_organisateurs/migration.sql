-- Reprise vers le profil du régime et des allergies déjà saisis sur les fiches artistes et
-- organisateurs, à la suite de celle des candidatures bénévoles.
--
-- Mêmes garanties : ne remplit que les vides, retient la déclaration la plus récente, ne
-- supprime rien, se rejoue sans dommage. Ce que la personne a mis dans son profil prime.
--
-- Les artistes sont repris AVANT les organisateurs, sans que l'ordre ait d'importance : chaque
-- passe ne touche que des profils encore vides, donc la seconde ne défait rien de la première.

-- ── Artistes : régime ──
UPDATE `User` u
JOIN (
  SELECT a.userId, a.dietaryPreference
  FROM `EditionArtist` a
  JOIN (
    SELECT userId, MAX(id) AS derniere
    FROM `EditionArtist`
    WHERE dietaryPreference <> 'NONE'
    GROUP BY userId
  ) r ON r.userId = a.userId AND r.derniere = a.id
) src ON src.userId = u.id
SET u.dietaryPreference = src.dietaryPreference
WHERE u.dietaryPreference = 'NONE';

-- ── Artistes : allergies et gravité, repris ensemble ──
UPDATE `User` u
JOIN (
  SELECT a.userId, a.allergies, a.allergySeverity
  FROM `EditionArtist` a
  JOIN (
    SELECT userId, MAX(id) AS derniere
    FROM `EditionArtist`
    WHERE allergies IS NOT NULL AND allergies <> ''
    GROUP BY userId
  ) r ON r.userId = a.userId AND r.derniere = a.id
) src ON src.userId = u.id
SET u.allergies = src.allergies,
    u.allergySeverity = COALESCE(u.allergySeverity, src.allergySeverity)
WHERE u.allergies IS NULL OR u.allergies = '';

-- ── Organisateurs : régime (l'utilisateur est atteint via ConventionOrganizer) ──
UPDATE `User` u
JOIN (
  SELECT co.userId, eo.dietaryPreference
  FROM `EditionOrganizer` eo
  JOIN `ConventionOrganizer` co ON co.id = eo.organizerId
  JOIN (
    SELECT co2.userId, MAX(eo2.id) AS derniere
    FROM `EditionOrganizer` eo2
    JOIN `ConventionOrganizer` co2 ON co2.id = eo2.organizerId
    WHERE eo2.dietaryPreference <> 'NONE'
    GROUP BY co2.userId
  ) r ON r.userId = co.userId AND r.derniere = eo.id
) src ON src.userId = u.id
SET u.dietaryPreference = src.dietaryPreference
WHERE u.dietaryPreference = 'NONE';

-- ── Organisateurs : allergies et gravité ──
UPDATE `User` u
JOIN (
  SELECT co.userId, eo.allergies, eo.allergySeverity
  FROM `EditionOrganizer` eo
  JOIN `ConventionOrganizer` co ON co.id = eo.organizerId
  JOIN (
    SELECT co2.userId, MAX(eo2.id) AS derniere
    FROM `EditionOrganizer` eo2
    JOIN `ConventionOrganizer` co2 ON co2.id = eo2.organizerId
    WHERE eo2.allergies IS NOT NULL AND eo2.allergies <> ''
    GROUP BY co2.userId
  ) r ON r.userId = co.userId AND r.derniere = eo.id
) src ON src.userId = u.id
SET u.allergies = src.allergies,
    u.allergySeverity = COALESCE(u.allergySeverity, src.allergySeverity)
WHERE u.allergies IS NULL OR u.allergies = '';

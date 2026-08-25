-- Reprise des informations personnelles déjà saisies dans les candidatures bénévoles vers le
-- profil, qui fait désormais foi.
--
-- Ne remplit que les vides : ce que la personne a elle-même mis dans son profil prime toujours.
-- En cas de plusieurs candidatures, la plus récente l'emporte — c'est la déclaration la plus à
-- jour.
--
-- Aucune donnée n'est supprimée : les colonnes des candidatures restent en place et continuent
-- de servir de repli. Cette migration est donc rejouable sans dommage et sans perte possible.

-- Régime alimentaire : `NONE` est la valeur par défaut, indistinguable de « non renseigné ».
UPDATE `User` u
JOIN (
  SELECT a.userId, a.dietaryPreference
  FROM `EditionVolunteerApplication` a
  JOIN (
    SELECT userId, MAX(createdAt) AS derniere
    FROM `EditionVolunteerApplication`
    WHERE dietaryPreference <> 'NONE'
    GROUP BY userId
  ) r ON r.userId = a.userId AND r.derniere = a.createdAt
  WHERE a.dietaryPreference <> 'NONE'
) src ON src.userId = u.id
SET u.dietaryPreference = src.dietaryPreference
WHERE u.dietaryPreference = 'NONE';

-- Allergies et gravité : repris ensemble depuis la même candidature, pour ne pas associer une
-- gravité à une description qui n'est pas la sienne.
UPDATE `User` u
JOIN (
  SELECT a.userId, a.allergies, a.allergySeverity
  FROM `EditionVolunteerApplication` a
  JOIN (
    SELECT userId, MAX(createdAt) AS derniere
    FROM `EditionVolunteerApplication`
    WHERE allergies IS NOT NULL AND allergies <> ''
    GROUP BY userId
  ) r ON r.userId = a.userId AND r.derniere = a.createdAt
  WHERE a.allergies IS NOT NULL AND a.allergies <> ''
) src ON src.userId = u.id
SET u.allergies = src.allergies,
    u.allergySeverity = COALESCE(u.allergySeverity, src.allergySeverity)
WHERE u.allergies IS NULL OR u.allergies = '';

-- Contact d'urgence : nom et téléphone repris ensemble, un nom sans numéro ne servant à rien.
UPDATE `User` u
JOIN (
  SELECT a.userId, a.emergencyContactName, a.emergencyContactPhone
  FROM `EditionVolunteerApplication` a
  JOIN (
    SELECT userId, MAX(createdAt) AS derniere
    FROM `EditionVolunteerApplication`
    WHERE emergencyContactName IS NOT NULL AND emergencyContactName <> ''
    GROUP BY userId
  ) r ON r.userId = a.userId AND r.derniere = a.createdAt
  WHERE a.emergencyContactName IS NOT NULL AND a.emergencyContactName <> ''
) src ON src.userId = u.id
SET u.emergencyContactName = src.emergencyContactName,
    u.emergencyContactPhone = COALESCE(u.emergencyContactPhone, src.emergencyContactPhone)
WHERE u.emergencyContactName IS NULL OR u.emergencyContactName = '';

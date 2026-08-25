-- Contrôle préalable à la suppression des colonnes dupliquées.
--
-- Compte les cas où une fiche porte encore une information que le profil ignore. Chacun de ces
-- cas serait PERDU par la suppression : c'est le repli qui les rend visibles aujourd'hui.
--
-- Le résultat attendu est zéro partout. Sinon, rejouer les migrations de reprise (elles sont
-- idempotentes) puis recompter.

SELECT 'candidatures : régime absent du profil' AS cas, COUNT(*) AS restants
FROM EditionVolunteerApplication a JOIN User u ON u.id = a.userId
WHERE a.dietaryPreference <> 'NONE' AND u.dietaryPreference = 'NONE'

UNION ALL SELECT 'candidatures : allergies absentes du profil', COUNT(*)
FROM EditionVolunteerApplication a JOIN User u ON u.id = a.userId
WHERE a.allergies IS NOT NULL AND a.allergies <> '' AND (u.allergies IS NULL OR u.allergies = '')

UNION ALL SELECT 'candidatures : contact d''urgence absent du profil', COUNT(*)
FROM EditionVolunteerApplication a JOIN User u ON u.id = a.userId
WHERE a.emergencyContactName IS NOT NULL AND a.emergencyContactName <> ''
  AND (u.emergencyContactName IS NULL OR u.emergencyContactName = '')

UNION ALL SELECT 'artistes : régime absent du profil', COUNT(*)
FROM EditionArtist a JOIN User u ON u.id = a.userId
WHERE a.dietaryPreference <> 'NONE' AND u.dietaryPreference = 'NONE'

UNION ALL SELECT 'artistes : allergies absentes du profil', COUNT(*)
FROM EditionArtist a JOIN User u ON u.id = a.userId
WHERE a.allergies IS NOT NULL AND a.allergies <> '' AND (u.allergies IS NULL OR u.allergies = '')

UNION ALL SELECT 'organisateurs : régime absent du profil', COUNT(*)
FROM EditionOrganizer eo
JOIN ConventionOrganizer co ON co.id = eo.organizerId JOIN User u ON u.id = co.userId
WHERE eo.dietaryPreference <> 'NONE' AND u.dietaryPreference = 'NONE'

UNION ALL SELECT 'organisateurs : allergies absentes du profil', COUNT(*)
FROM EditionOrganizer eo
JOIN ConventionOrganizer co ON co.id = eo.organizerId JOIN User u ON u.id = co.userId
WHERE eo.allergies IS NOT NULL AND eo.allergies <> '' AND (u.allergies IS NULL OR u.allergies = '');

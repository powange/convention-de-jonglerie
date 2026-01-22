-- Mettre à jour isOrganizer = true pour tous les utilisateurs ayant créé ou organisé au moins une convention
UPDATE User
SET isOrganizer = true
WHERE id IN (
  SELECT DISTINCT creatorId
  FROM Convention
  WHERE creatorId IS NOT NULL
  UNION
  SELECT DISTINCT userId
  FROM ConventionOrganizer
);

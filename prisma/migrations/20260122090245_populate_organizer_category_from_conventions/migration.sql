-- Mettre à jour isOrganizer = true pour tous les utilisateurs ayant créé ou organisé au moins une convention/édition
UPDATE User
SET isOrganizer = true
WHERE id IN (
  SELECT DISTINCT authorId
  FROM Convention
  WHERE authorId IS NOT NULL
  UNION
  SELECT DISTINCT userId
  FROM ConventionOrganizer
  UNION
  SELECT DISTINCT creatorId
  FROM Edition
  WHERE creatorId IS NOT NULL
);

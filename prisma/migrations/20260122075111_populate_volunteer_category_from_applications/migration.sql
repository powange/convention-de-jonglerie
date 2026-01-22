-- Mettre à jour isVolunteer = true pour tous les utilisateurs ayant au moins une candidature de bénévolat
UPDATE User
SET isVolunteer = true
WHERE id IN (
  SELECT DISTINCT userId
  FROM EditionVolunteerApplication
);

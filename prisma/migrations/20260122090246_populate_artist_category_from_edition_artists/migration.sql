-- Mettre à jour isArtist = true pour tous les utilisateurs ayant au moins un profil artiste
UPDATE User
SET isArtist = true
WHERE id IN (
  SELECT DISTINCT userId
  FROM EditionArtist
);

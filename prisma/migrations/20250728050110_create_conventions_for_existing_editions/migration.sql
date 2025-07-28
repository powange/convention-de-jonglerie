-- Migration pour créer des conventions pour les éditions existantes sans convention

-- Créer une convention pour chaque édition qui n'a pas de conventionId
INSERT INTO Convention (name, description, authorId, createdAt, updatedAt)
SELECT 
    CONCAT(e.name, ' - Convention') as name,
    CONCAT('Convention créée automatiquement pour l\'édition: ', e.name) as description,
    e.creatorId as authorId,
    NOW() as createdAt,
    NOW() as updatedAt
FROM Edition e
WHERE e.conventionId IS NULL;

-- Mettre à jour les éditions pour les lier aux conventions nouvellement créées
UPDATE Edition e
SET conventionId = (
    SELECT c.id 
    FROM Convention c 
    WHERE c.authorId = e.creatorId 
    AND c.name = CONCAT(e.name, ' - Convention')
    LIMIT 1
)
WHERE e.conventionId IS NULL;
-- Ajouter les auteurs comme collaborateurs ADMINISTRATOR pour toutes les conventions qui n'ont pas de collaborateurs
INSERT INTO `ConventionCollaborator` (`conventionId`, `userId`, `role`, `addedAt`, `addedById`)
SELECT 
    c.`id` as `conventionId`,
    c.`authorId` as `userId`,
    'ADMINISTRATOR' as `role`,
    NOW() as `addedAt`,
    c.`authorId` as `addedById`
FROM `Convention` c
LEFT JOIN `ConventionCollaborator` cc ON c.`id` = cc.`conventionId`
WHERE cc.`id` IS NULL;
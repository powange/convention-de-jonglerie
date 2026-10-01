-- Rattrapage des lignes ANTÉRIEURES à l'ajout de `phases`.
--
-- ⚠️ POURQUOI UNE SECONDE MIGRATION. La précédente a été générée par Prisma sous la forme
-- `ADD COLUMN phases JSON NOT NULL`, sans `DEFAULT` : `@default("[]")` est un défaut CLIENT, que
-- Prisma applique à la création d'une ligne, et non une contrainte de base. MySQL a donc rempli
-- les lignes déjà présentes avec le JSON `null` — vérifié sur la base de développement :
-- 17 lignes, `JSON_TYPE(phases) = 'NULL'`.
--
-- `null` n'est pas `[]`. La règle du code dit « tableau vide = toutes les phases » ; une lecture
-- qui recevrait `null` ne trouverait pas de tableau à parcourir, et une association existante
-- cesserait d'être remise à qui que ce soit — sans erreur, et sans que rien ne le signale.
--
-- La migration précédente n'est pas retouchée : Prisma en conserve l'empreinte, et toute
-- modification ferait échouer les contrôles d'intégrité. C'est la séparation prévue entre
-- l'`ALTER` — le défaut, pour les lignes à venir — et l'`UPDATE` — le rattrapage de l'existant.
UPDATE `EditionVolunteerHandoutItem`
SET `phases` = JSON_ARRAY()
WHERE JSON_TYPE(`phases`) = 'NULL';

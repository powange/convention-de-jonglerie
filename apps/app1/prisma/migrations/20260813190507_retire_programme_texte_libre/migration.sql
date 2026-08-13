-- Retrait du programme en texte libre, remplacé par la frise d'éléments datés.
--
-- Écrite à la main : `prisma migrate dev` refuse de générer une migration destructive sans
-- confirmation interactive. Le contenu de ces deux emplacements est du déroulé horaire
-- (« VENDREDI 14h - Ouverture du site, 18h - Scène ouverte… »), que chaque moment porte
-- désormais avec son horaire, son lieu et sa visibilité.

-- Programme général d'une édition, saisi en Markdown.
ALTER TABLE `Edition` DROP COLUMN `program`;

-- Programme jour par jour : une ligne de texte par journée.
DROP TABLE `EditionProgramDay`;

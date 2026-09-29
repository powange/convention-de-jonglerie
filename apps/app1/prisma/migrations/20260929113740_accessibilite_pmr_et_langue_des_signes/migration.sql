-- Accessibilité : l'accès PMR est nommé pour ce qu'il est, et la langue des signes le rejoint.
--
-- ⚠️ Un RENAME, et NON un DROP suivi d'un ADD. Prisma génère le second par défaut sur un
-- renommage de colonne, ce qui aurait effacé les 12 éditions déclarées accessibles — un champ
-- remis à « non » se lit comme une convention qui ne l'est pas, sans que rien ne le signale.
ALTER TABLE `Edition` RENAME COLUMN `hasAccessibility` TO `hasPrmAccess`;

-- La langue des signes pratiquée sur place. Les éditions existantes partent à « non » : personne
-- ne peut l'affirmer à leur place, et le défaut du champ est le seul aveu honnête d'ignorance.
ALTER TABLE `Edition` ADD COLUMN `hasSignLanguage` BOOLEAN NOT NULL DEFAULT false;

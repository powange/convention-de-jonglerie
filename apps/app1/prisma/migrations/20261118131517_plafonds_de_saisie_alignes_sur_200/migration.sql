-- Aligne six colonnes sur le plafond que la validation d'entrée annonce déjà.
--
-- Prisma crée un `String` MySQL en VARCHAR(191) — la limite d'index utf8mb4 — alors que les
-- schémas zod de ces six champs plafonnent à 200. Une saisie de 192 à 200 caractères passait donc
-- la validation et CASSAIT à l'écriture : l'utilisateur recevait une erreur serveur pour un texte
-- qu'on l'avait laissé taper, et rien à l'écran ne lui disait qu'il était trop long.
--
-- Constaté sur `Task.title` (un 500 du point d'API), puis les cinq autres trouvés en reliant chaque
-- schéma zod à SA table — le nom du champ ne suffit pas : `title` existe en VARCHAR(150), (191) et
-- (200) selon le modèle.
--
-- Élargir plutôt que rogner zod : 200 est l'intention déclarée, et réduire une limite publique à
-- 191 serait un changement de produit déguisé en correctif.
--
-- ⚠️ NON DESTRUCTEUR : six `MODIFY` qui élargissent, aucun `DROP`, nullabilité inchangée. Et
-- aucune de ces colonnes n'est indexée — vérifié modèle par modèle —, donc la limite d'index
-- MySQL qui justifie le 191 par défaut ne s'applique pas ici.

-- AlterTable
ALTER TABLE `CarpoolOffer` MODIFY `locationAddress` VARCHAR(200) NOT NULL;

-- AlterTable
ALTER TABLE `Edition` MODIFY `name` VARCHAR(200) NULL;

-- AlterTable
ALTER TABLE `Feedback` MODIFY `subject` VARCHAR(200) NOT NULL;

-- AlterTable
ALTER TABLE `Task` MODIFY `title` VARCHAR(200) NOT NULL;

-- AlterTable
ALTER TABLE `TaskChecklistItem` MODIFY `title` VARCHAR(200) NOT NULL;

-- AlterTable
ALTER TABLE `Workshop` MODIFY `title` VARCHAR(200) NOT NULL;

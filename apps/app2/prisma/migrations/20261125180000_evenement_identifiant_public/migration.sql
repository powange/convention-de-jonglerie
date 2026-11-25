-- Identifiant public des événements (adresses non prédictibles). Non destructive.

-- 1. La colonne, nullable le temps de remplir les lignes existantes.
ALTER TABLE `Event` ADD COLUMN `publicId` VARCHAR(16) NULL;

-- 2. Un identifiant aléatoire pour chaque événement existant (10 caractères hexadécimaux) ; les
--    nouveaux reçoivent le leur du client Prisma (`nanoid(10)`).
UPDATE `Event` SET `publicId` = LOWER(HEX(RANDOM_BYTES(5))) WHERE `publicId` IS NULL;

-- 3. Obligatoire et unique.
ALTER TABLE `Event` MODIFY `publicId` VARCHAR(16) NOT NULL;
CREATE UNIQUE INDEX `Event_publicId_key` ON `Event`(`publicId`);

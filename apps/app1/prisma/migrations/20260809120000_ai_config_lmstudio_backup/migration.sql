-- Adresse LM Studio de secours.
--
-- Le modèle local tourne sur une machine du réseau : elle s'éteint, redémarre, change d'adresse.
-- Une seconde adresse permet de basculer sans passer par l'écran d'administration au moment
-- précis où l'on a besoin du service.
--
-- Nullable et sans valeur par défaut : un secours n'a de sens que s'il est choisi. Une valeur par
-- défaut ferait croire à une redondance là où il n'y en a pas.
ALTER TABLE `AiConfig` ADD COLUMN `lmstudioBackupBaseUrl` VARCHAR(191) NULL;

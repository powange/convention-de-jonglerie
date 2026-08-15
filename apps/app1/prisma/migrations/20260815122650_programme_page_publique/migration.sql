-- Visibilité publique de la frise du programme, distincte de l'activation du module.
--
-- Écrite à la main pour la reprise : le défaut `false` conviendrait aux éditions à venir, mais
-- l'appliquer tel quel aux éditions dont le programme est déjà activé le ferait disparaître du
-- public au déploiement, sans que leurs organisateurs en soient avertis. On préserve donc
-- l'existant en publiant ce qui l'était déjà.
ALTER TABLE `Edition` ADD COLUMN `programPagePublic` BOOLEAN NOT NULL DEFAULT false;

-- Reprise : ce qui était visible le reste.
UPDATE `Edition` SET `programPagePublic` = true WHERE `programEnabled` = true;

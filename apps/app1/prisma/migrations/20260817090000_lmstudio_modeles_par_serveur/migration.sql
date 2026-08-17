-- Modèles propres à chaque serveur LM Studio.
--
-- Deux machines n'hébergent pas forcément les mêmes modèles : réclamer à celle de secours le
-- modèle de la principale la ferait échouer alors qu'elle répondait. Nuls, les modèles de
-- secours signifient « comme le serveur principal », ce qui laisse les configurations
-- existantes se comporter exactement comme avant.
ALTER TABLE `AiConfig`
  ADD COLUMN `lmstudioBackupModelId` VARCHAR(191) NULL,
  ADD COLUMN `lmstudioBackupTextModelId` VARCHAR(191) NULL;

-- Le catalogue des modèles est lui aussi propre à chaque serveur. Les modèles déjà enregistrés
-- décrivent la machine principale : c'est la seule que l'interface interrogeait jusqu'ici.
ALTER TABLE `AiModel`
  ADD COLUMN `serveur` VARCHAR(191) NOT NULL DEFAULT 'principal';

DROP INDEX `AiModel_provider_modelId_key` ON `AiModel`;

CREATE UNIQUE INDEX `AiModel_provider_serveur_modelId_key` ON `AiModel`(`provider`, `serveur`, `modelId`);

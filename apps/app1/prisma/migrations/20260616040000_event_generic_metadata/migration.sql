-- Étape 0bis — promotion des métadonnées génériques (name/startDate/endDate/status) vers Event.
-- Migration hand-authored, data-preserving : on ajoute les colonnes puis on les backfill depuis
-- Edition (+ Convention pour le nom d'affichage). Les colonnes correspondantes restent sur Edition
-- (source de vérité côté jonglerie) ; l'app les maintient en miroir sur Event à la création/màj.

-- 1. Nouvelles colonnes génériques sur Event
ALTER TABLE `Event`
  ADD COLUMN `name` VARCHAR(191) NULL,
  ADD COLUMN `startDate` DATETIME(3) NULL,
  ADD COLUMN `endDate` DATETIME(3) NULL,
  ADD COLUMN `status` ENUM('PLANNED', 'PUBLISHED', 'OFFLINE', 'CANCELLED') NOT NULL DEFAULT 'OFFLINE';

-- 2. Backfill depuis Edition (+ Convention) — Edition.eventId == Event.id
UPDATE `Event` `e`
  JOIN `Edition` `ed` ON `ed`.`eventId` = `e`.`id`
  JOIN `Convention` `c` ON `c`.`id` = `ed`.`conventionId`
SET
  `e`.`name` = CONCAT(`c`.`name`, IF(`ed`.`name` IS NOT NULL AND `ed`.`name` <> '', CONCAT(' - ', `ed`.`name`), '')),
  `e`.`startDate` = `ed`.`startDate`,
  `e`.`endDate` = `ed`.`endDate`,
  `e`.`status` = `ed`.`status`;

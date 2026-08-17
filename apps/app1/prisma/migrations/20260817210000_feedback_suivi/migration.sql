-- Suivi d'un retour par son auteur, depuis /feedback.
--
-- `resolved` répondait par oui ou non à « est-ce terminé ? », alors que celui qui attend se
-- demande d'abord si son message a seulement été regardé. `status` distingue les quatre états
-- que l'équipe fait réellement suivre à un retour.
--
-- `adminReply` est la réponse écrite à l'auteur, et ne doit pas être confondue avec
-- `adminNotes`, qui reste une note interne et n'est jamais renvoyée par l'API publique.

ALTER TABLE `Feedback`
  ADD COLUMN `status` ENUM('NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED') NOT NULL DEFAULT 'NEW',
  ADD COLUMN `adminReply` TEXT NULL,
  ADD COLUMN `repliedAt` DATETIME(3) NULL;

-- Les retours déjà marqués traités gardent cet état ; les autres retombent sur NEW par défaut.
UPDATE `Feedback` SET `status` = 'RESOLVED' WHERE `resolved` = TRUE;

DROP INDEX `Feedback_resolved_idx` ON `Feedback`;

ALTER TABLE `Feedback` DROP COLUMN `resolved`;

CREATE INDEX `Feedback_status_idx` ON `Feedback`(`status`);

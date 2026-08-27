-- Un groupe de messagerie dédié à un spectacle.
--
-- Écrire à toute la distribution d'un spectacle obligeait jusqu'ici à ouvrir une conversation
-- privée par artiste, et à recomposer la liste des destinataires à la main à chaque fois.
--
-- Le lien est porté par `Conversation.showId`, unique : un spectacle n'a qu'un groupe, qu'on
-- retrouve à chaque ouverture plutôt que d'en créer un second. La suppression du spectacle
-- emporte la conversation, comme pour les candidatures artiste.

ALTER TABLE `Conversation`
  MODIFY `type` ENUM(
    'TEAM_GROUP',
    'TEAM_LEADER_PRIVATE',
    'VOLUNTEER_TO_ORGANIZERS',
    'ORGANIZERS_GROUP',
    'PRIVATE',
    'ARTIST_APPLICATION',
    'SHOW_GROUP'
  ) NOT NULL;

ALTER TABLE `Conversation` ADD COLUMN `showId` INTEGER NULL;

CREATE UNIQUE INDEX `Conversation_showId_key` ON `Conversation`(`showId`);
CREATE INDEX `Conversation_showId_idx` ON `Conversation`(`showId`);

ALTER TABLE `Conversation`
  ADD CONSTRAINT `Conversation_showId_fkey`
  FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

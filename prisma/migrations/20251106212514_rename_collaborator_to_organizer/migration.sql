/*
  Warnings:

  - Renamed table `ConventionCollaborator` to `ConventionOrganizer`
  - Renamed table `EditionCollaboratorPermission` to `EditionOrganizerPermission`
  - Renamed table `CollaboratorPermissionHistory` to `OrganizerPermissionHistory`
  - Renamed column `canManageCollaborators` to `canManageOrganizers` in `ConventionOrganizer`
  - Renamed column `collaboratorId` to `organizerId` in `EditionOrganizerPermission`

*/

-- Étape 1: Renommer les tables
RENAME TABLE `ConventionCollaborator` TO `ConventionOrganizer`;
RENAME TABLE `EditionCollaboratorPermission` TO `EditionOrganizerPermission`;
RENAME TABLE `CollaboratorPermissionHistory` TO `OrganizerPermissionHistory`;

-- Étape 2: Renommer la colonne canManageCollaborators en canManageOrganizers dans ConventionOrganizer
ALTER TABLE `ConventionOrganizer`
  CHANGE COLUMN `canManageCollaborators` `canManageOrganizers` BOOLEAN NOT NULL DEFAULT false;

-- Étape 3: Supprimer la contrainte de clé étrangère sur collaboratorId dans EditionOrganizerPermission
ALTER TABLE `EditionOrganizerPermission`
  DROP FOREIGN KEY `EditionCollaboratorPermission_collaboratorId_fkey`;

-- Étape 4: Renommer la colonne collaboratorId en organizerId dans EditionOrganizerPermission
ALTER TABLE `EditionOrganizerPermission`
  CHANGE COLUMN `collaboratorId` `organizerId` INTEGER NOT NULL;

-- Étape 5: Supprimer l'ancien index unique sur collaboratorId_editionId
ALTER TABLE `EditionOrganizerPermission`
  DROP INDEX `EditionCollaboratorPermission_collaboratorId_editionId_key`;

-- Étape 6: Créer le nouvel index unique sur organizerId_editionId
ALTER TABLE `EditionOrganizerPermission`
  ADD UNIQUE INDEX `EditionOrganizerPermission_organizerId_editionId_key`(`organizerId`, `editionId`);

-- Étape 7: Recréer la contrainte de clé étrangère avec le nouveau nom
ALTER TABLE `EditionOrganizerPermission`
  ADD CONSTRAINT `EditionOrganizerPermission_organizerId_fkey`
  FOREIGN KEY (`organizerId`) REFERENCES `ConventionOrganizer`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Étape 8: Mettre à jour les noms des index dans ConventionOrganizer
ALTER TABLE `ConventionOrganizer`
  DROP INDEX `ConventionCollaborator_addedById_fkey`,
  ADD INDEX `ConventionOrganizer_addedById_fkey`(`addedById`);

ALTER TABLE `ConventionOrganizer`
  DROP INDEX `ConventionCollaborator_userId_fkey`,
  ADD INDEX `ConventionOrganizer_userId_fkey`(`userId`);

ALTER TABLE `ConventionOrganizer`
  DROP INDEX `ConventionCollaborator_conventionId_userId_key`,
  ADD UNIQUE INDEX `ConventionOrganizer_conventionId_userId_key`(`conventionId`, `userId`);

-- Étape 9: Mettre à jour les noms des contraintes de clé étrangère dans ConventionOrganizer
ALTER TABLE `ConventionOrganizer`
  DROP FOREIGN KEY `ConventionCollaborator_addedById_fkey`,
  ADD CONSTRAINT `ConventionOrganizer_addedById_fkey`
  FOREIGN KEY (`addedById`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ConventionOrganizer`
  DROP FOREIGN KEY `ConventionCollaborator_conventionId_fkey`,
  ADD CONSTRAINT `ConventionOrganizer_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ConventionOrganizer`
  DROP FOREIGN KEY `ConventionCollaborator_userId_fkey`,
  ADD CONSTRAINT `ConventionOrganizer_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Étape 10: Mettre à jour les noms des contraintes dans OrganizerPermissionHistory
ALTER TABLE `OrganizerPermissionHistory`
  DROP FOREIGN KEY `CollaboratorPermissionHistory_actorId_fkey`,
  ADD CONSTRAINT `OrganizerPermissionHistory_actorId_fkey`
  FOREIGN KEY (`actorId`) REFERENCES `User`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrganizerPermissionHistory`
  DROP FOREIGN KEY `CollaboratorPermissionHistory_conventionId_fkey`,
  ADD CONSTRAINT `OrganizerPermissionHistory_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OrganizerPermissionHistory`
  DROP FOREIGN KEY `CollaboratorPermissionHistory_targetUserId_fkey`,
  ADD CONSTRAINT `OrganizerPermissionHistory_targetUserId_fkey`
  FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Étape 11: Mettre à jour les noms des index dans OrganizerPermissionHistory
ALTER TABLE `OrganizerPermissionHistory`
  DROP INDEX `CollaboratorPermissionHistory_conventionId_idx`,
  ADD INDEX `OrganizerPermissionHistory_conventionId_idx`(`conventionId`);

ALTER TABLE `OrganizerPermissionHistory`
  DROP INDEX `CollaboratorPermissionHistory_actorId_idx`,
  ADD INDEX `OrganizerPermissionHistory_actorId_idx`(`actorId`);

ALTER TABLE `OrganizerPermissionHistory`
  DROP INDEX `CollaboratorPermissionHistory_changeType_idx`,
  ADD INDEX `OrganizerPermissionHistory_changeType_idx`(`changeType`);

ALTER TABLE `OrganizerPermissionHistory`
  DROP INDEX `CollaboratorPermissionHistory_targetUserId_idx`,
  ADD INDEX `OrganizerPermissionHistory_targetUserId_idx`(`targetUserId`);

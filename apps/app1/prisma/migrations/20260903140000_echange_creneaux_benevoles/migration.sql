-- Échange de créneaux entre bénévoles.
--
-- Un bénévole qui ne peut plus tenir son créneau n'avait qu'un recours : écrire à l'organisation,
-- qui refaisait le planning à la main. Il peut désormais proposer un échange, un pour un, à un
-- bénévole de ses propres équipes.
--
-- Deux accords sont exigés avant que le planning bouge : celui du bénévole visé, puis celui d'un
-- organisateur ayant le droit de gérer les bénévoles. L'arrangement qui convient à deux personnes
-- peut dégarnir un poste que ni l'une ni l'autre ne voit.
--
-- Les deux affectations sont référencées en CASCADE : si l'une disparaît — désaffectation à la
-- main, relance de l'assignation automatique — la demande s'efface avec elle. Elle porterait
-- sinon sur un créneau que plus personne ne tient.
--
-- `decidedById` est en SET NULL : la suppression d'un compte d'organisateur ne doit pas effacer
-- l'historique d'un échange déjà tranché.

CREATE TABLE `VolunteerSwapRequest` (
  `id` VARCHAR(191) NOT NULL,
  `eventId` INTEGER NOT NULL,
  `requesterId` INTEGER NOT NULL,
  `targetId` INTEGER NOT NULL,
  `requesterAssignmentId` VARCHAR(191) NOT NULL,
  `targetAssignmentId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING_PEER', 'PENDING_MANAGER', 'ACCEPTED', 'REFUSED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PEER',
  `peerRespondedAt` DATETIME(3) NULL,
  `decidedById` INTEGER NULL,
  `decidedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `VolunteerSwapRequest_eventId_status_idx`(`eventId`, `status`),
  INDEX `VolunteerSwapRequest_requesterId_idx`(`requesterId`),
  INDEX `VolunteerSwapRequest_targetId_idx`(`targetId`),
  INDEX `VolunteerSwapRequest_requesterAssignmentId_idx`(`requesterAssignmentId`),
  INDEX `VolunteerSwapRequest_targetAssignmentId_idx`(`targetAssignmentId`),
  INDEX `VolunteerSwapRequest_decidedById_idx`(`decidedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_requesterAssignmentId_fkey` FOREIGN KEY (`requesterAssignmentId`) REFERENCES `VolunteerAssignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VolunteerSwapRequest` ADD CONSTRAINT `VolunteerSwapRequest_targetAssignmentId_fkey` FOREIGN KEY (`targetAssignmentId`) REFERENCES `VolunteerAssignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

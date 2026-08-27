-- Origine d'une affectation de bénévole : posée à la main, ou produite par l'assignation
-- automatique.
--
-- `assignedById` ne pouvait pas en tenir lieu : l'organisateur qui lance le calcul y figure
-- exactement comme s'il avait tout posé lui-même. Sans cette distinction, relancer le calcul
-- obligeait à choisir entre tout effacer — y compris les décisions humaines — ou ne rien
-- effacer du tout.
--
-- Les lignes déjà en base prennent MANUAL par défaut : leur origine réelle est perdue, et
-- c'est le choix prudent — une relance ne les balaiera pas par surprise.

ALTER TABLE `VolunteerAssignment` ADD COLUMN `source` ENUM('MANUAL', 'AUTO') NOT NULL DEFAULT 'MANUAL';

CREATE INDEX `VolunteerAssignment_source_idx` ON `VolunteerAssignment`(`source`);

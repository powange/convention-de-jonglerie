-- Les échanges de créneaux deviennent optionnels par édition. Valeur par défaut vraie : les
-- éditions existantes gardent le comportement qu'elles avaient avant ce réglage, sans que
-- personne ait à intervenir.
ALTER TABLE `EventVolunteerSettings` ADD COLUMN `swapsEnabled` BOOLEAN NOT NULL DEFAULT true;

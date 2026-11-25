-- Droits par domaine des organisateurs d'un événement. Non destructive.
ALTER TABLE `EditionOrganizer`
    ADD COLUMN `canEditEvent` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageOrganizers` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canManageVolunteers` BOOLEAN NOT NULL DEFAULT false;

-- Les organisateurs déjà déclarés avaient jusqu'ici TOUS les droits (sauf supprimer) : ils les gardent.
UPDATE `EditionOrganizer` SET `canEditEvent` = true, `canManageOrganizers` = true, `canManageVolunteers` = true;

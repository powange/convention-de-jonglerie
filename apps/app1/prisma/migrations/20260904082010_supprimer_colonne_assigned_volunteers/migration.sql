-- La colonne n'a jamais été ni écrite ni lue : aucun `increment`, aucune mise à jour lors d'une
-- affectation, et aucune requête ne la sélectionnait. Vérifié en base avant suppression : 403
-- lignes, toutes à 0. L'occupation d'un créneau se compte sur ses affectations réelles
-- (`_count.assignments`), comme partout ailleurs dans le dépôt.
ALTER TABLE `VolunteerTimeSlot` DROP COLUMN `assignedVolunteers`;

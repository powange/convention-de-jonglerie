-- Rattrapage : recopie le fuseau de chaque édition dans son Event.
-- Les éditions créées ou modifiées ensuite le sont par `syncEventMetadataFromEdition`.
UPDATE `Event` e
INNER JOIN `Edition` ed ON ed.`eventId` = e.`id`
SET e.`timezone` = ed.`timezone`;

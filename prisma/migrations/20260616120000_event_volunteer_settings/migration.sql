-- Étape 0bis — extraction de la config bénévole d'Edition vers EventVolunteerSettings (1:1 Event).
-- Migration hand-authored, data-preserving : crée la table, backfill depuis Edition, puis drop des
-- colonnes volunteers* d'Edition.

-- 1. Table de config bénévole (PK = eventId, 1:1 avec Event)
CREATE TABLE `EventVolunteerSettings` (
    `eventId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `open` BOOLEAN NOT NULL DEFAULT false,
    `pagePublic` BOOLEAN NOT NULL DEFAULT false,
    `mode` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
    `description` TEXT NULL,
    `externalUrl` VARCHAR(191) NULL,
    `setupStartDate` DATETIME(3) NULL,
    `teardownEndDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NULL,
    `askDiet` BOOLEAN NOT NULL DEFAULT false,
    `askAllergies` BOOLEAN NOT NULL DEFAULT false,
    `askTimePreferences` BOOLEAN NOT NULL DEFAULT false,
    `askTeamPreferences` BOOLEAN NOT NULL DEFAULT false,
    `askPets` BOOLEAN NOT NULL DEFAULT false,
    `askMinors` BOOLEAN NOT NULL DEFAULT false,
    `askVehicle` BOOLEAN NOT NULL DEFAULT false,
    `askCompanion` BOOLEAN NOT NULL DEFAULT false,
    `askAvoidList` BOOLEAN NOT NULL DEFAULT false,
    `askSkills` BOOLEAN NOT NULL DEFAULT false,
    `askExperience` BOOLEAN NOT NULL DEFAULT false,
    `askEmergencyContact` BOOLEAN NOT NULL DEFAULT false,
    `askSetup` BOOLEAN NOT NULL DEFAULT false,
    `askTeardown` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`eventId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Backfill depuis Edition (Edition.eventId == Event.id)
INSERT INTO `EventVolunteerSettings` (
    `eventId`, `enabled`, `open`, `pagePublic`, `mode`, `description`, `externalUrl`,
    `setupStartDate`, `teardownEndDate`, `updatedAt`,
    `askDiet`, `askAllergies`, `askTimePreferences`, `askTeamPreferences`, `askPets`, `askMinors`,
    `askVehicle`, `askCompanion`, `askAvoidList`, `askSkills`, `askExperience`, `askEmergencyContact`,
    `askSetup`, `askTeardown`
)
SELECT
    `eventId`, `volunteersEnabled`, `volunteersOpen`, `volunteersPagePublic`, `volunteersMode`,
    `volunteersDescription`, `volunteersExternalUrl`,
    `volunteersSetupStartDate`, `volunteersTeardownEndDate`, `volunteersUpdatedAt`,
    `volunteersAskDiet`, `volunteersAskAllergies`, `volunteersAskTimePreferences`,
    `volunteersAskTeamPreferences`, `volunteersAskPets`, `volunteersAskMinors`, `volunteersAskVehicle`,
    `volunteersAskCompanion`, `volunteersAskAvoidList`, `volunteersAskSkills`, `volunteersAskExperience`,
    `volunteersAskEmergencyContact`, `volunteersAskSetup`, `volunteersAskTeardown`
FROM `Edition`;

-- 3. Clé étrangère vers Event
ALTER TABLE `EventVolunteerSettings`
    ADD CONSTRAINT `EventVolunteerSettings_eventId_fkey`
    FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Suppression des colonnes volunteers* d'Edition (déplacées)
ALTER TABLE `Edition`
    DROP COLUMN `volunteersEnabled`,
    DROP COLUMN `volunteersDescription`,
    DROP COLUMN `volunteersPagePublic`,
    DROP COLUMN `volunteersOpen`,
    DROP COLUMN `volunteersUpdatedAt`,
    DROP COLUMN `volunteersExternalUrl`,
    DROP COLUMN `volunteersMode`,
    DROP COLUMN `volunteersAskDiet`,
    DROP COLUMN `volunteersAskAllergies`,
    DROP COLUMN `volunteersAskTimePreferences`,
    DROP COLUMN `volunteersAskTeamPreferences`,
    DROP COLUMN `volunteersAskPets`,
    DROP COLUMN `volunteersAskMinors`,
    DROP COLUMN `volunteersAskVehicle`,
    DROP COLUMN `volunteersAskCompanion`,
    DROP COLUMN `volunteersAskAvoidList`,
    DROP COLUMN `volunteersAskSkills`,
    DROP COLUMN `volunteersAskExperience`,
    DROP COLUMN `volunteersAskEmergencyContact`,
    DROP COLUMN `volunteersTeardownEndDate`,
    DROP COLUMN `volunteersSetupStartDate`,
    DROP COLUMN `volunteersAskSetup`,
    DROP COLUMN `volunteersAskTeardown`;

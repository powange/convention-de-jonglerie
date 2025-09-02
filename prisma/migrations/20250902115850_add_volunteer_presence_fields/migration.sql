-- AlterTable
ALTER TABLE `Edition` 
ADD COLUMN `volunteersTeardownEndDate` DATETIME(3) NULL,
ADD COLUMN `volunteersSetupStartDate` DATETIME(3) NULL,
ADD COLUMN `volunteersAskSetup` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `volunteersAskTeardown` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `EditionVolunteerApplication` 
ADD COLUMN `setupAvailability` BOOLEAN NULL,
ADD COLUMN `teardownAvailability` BOOLEAN NULL,
ADD COLUMN `arrivalDateTime` VARCHAR(191) NULL,
ADD COLUMN `departureDateTime` VARCHAR(191) NULL;
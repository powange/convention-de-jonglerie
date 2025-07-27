-- AlterTable
ALTER TABLE `Convention` ADD COLUMN `hasAccessibility` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasAerialSpace` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasCantine` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasConcert` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasFamilyCamping` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasFireSpace` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasGala` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasOpenStage` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasShowers` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasSlacklineSpace` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasToilets` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasWorkshops` BOOLEAN NOT NULL DEFAULT false;

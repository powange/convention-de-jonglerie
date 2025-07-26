/*
  Warnings:

  - You are about to drop the column `services` on the `Convention` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Convention` DROP COLUMN `services`,
    ADD COLUMN `acceptsPets` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasFastfood` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasGym` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasKidsZone` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasTentCamping` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hasTruckCamping` BOOLEAN NOT NULL DEFAULT false;

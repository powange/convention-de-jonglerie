/*
  Warnings:

  - You are about to drop the column `location` on the `Convention` table. All the data in the column will be lost.
  - Added the required column `addressLine1` to the `Convention` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `Convention` table without a default value. This is not possible if the table is not empty.
  - Added the required column `country` to the `Convention` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postalCode` to the `Convention` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Convention` DROP COLUMN `location`,
    ADD COLUMN `addressLine1` VARCHAR(191) NOT NULL,
    ADD COLUMN `addressLine2` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NOT NULL,
    ADD COLUMN `country` VARCHAR(191) NOT NULL,
    ADD COLUMN `postalCode` VARCHAR(191) NOT NULL,
    ADD COLUMN `region` VARCHAR(191) NULL;

/*
  Warnings:

  - You are about to drop the column `conventionId` on the `CarpoolOffer` table. All the data in the column will be lost.
  - You are about to drop the column `conventionId` on the `CarpoolRequest` table. All the data in the column will be lost.
  - Added the required column `editionId` to the `CarpoolOffer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `editionId` to the `CarpoolRequest` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `CarpoolOffer` DROP FOREIGN KEY `CarpoolOffer_conventionId_fkey`;

-- DropForeignKey
ALTER TABLE `CarpoolRequest` DROP FOREIGN KEY `CarpoolRequest_conventionId_fkey`;

-- DropIndex
DROP INDEX `CarpoolOffer_conventionId_fkey` ON `CarpoolOffer`;

-- DropIndex
DROP INDEX `CarpoolRequest_conventionId_fkey` ON `CarpoolRequest`;

-- AlterTable
ALTER TABLE `CarpoolOffer` DROP COLUMN `conventionId`,
    ADD COLUMN `editionId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `CarpoolRequest` DROP COLUMN `conventionId`,
    ADD COLUMN `editionId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `CarpoolOffer` ADD CONSTRAINT `CarpoolOffer_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequest` ADD CONSTRAINT `CarpoolRequest_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

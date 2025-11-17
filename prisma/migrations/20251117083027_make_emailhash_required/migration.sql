/*
  Warnings:

  - Made the column `emailHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `User` MODIFY `emailHash` VARCHAR(191) NOT NULL;

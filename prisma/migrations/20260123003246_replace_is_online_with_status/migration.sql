/*
  Warnings:

  - You are about to drop the column `isOnline` on the `Edition` table. All the data in the column will be lost.

*/
-- CreateEnum: Create the EditionStatus enum
-- (This is implicit in the ALTER TABLE below)

-- Step 1: Add the new status column with default value
ALTER TABLE `Edition` ADD COLUMN `status` ENUM('PLANNED', 'PUBLISHED', 'OFFLINE', 'CANCELLED') NOT NULL DEFAULT 'OFFLINE';

-- Step 2: Migrate existing data
-- Convert isOnline = true to status = 'PUBLISHED'
UPDATE `Edition` SET `status` = 'PUBLISHED' WHERE `isOnline` = 1;

-- Convert isOnline = false to status = 'OFFLINE' (already default, but explicit for clarity)
UPDATE `Edition` SET `status` = 'OFFLINE' WHERE `isOnline` = 0;

-- Step 3: Remove the old isOnline column
ALTER TABLE `Edition` DROP COLUMN `isOnline`;

-- Step 1: Add the new visibility column with default CLOSED
ALTER TABLE `EditionShowCall` ADD COLUMN `visibility` ENUM('OFFLINE', 'CLOSED', 'PRIVATE', 'PUBLIC') NOT NULL DEFAULT 'OFFLINE';

-- Step 2: Migrate existing data (isOpen: true -> PUBLIC, isOpen: false -> CLOSED)
UPDATE `EditionShowCall` SET `visibility` = 'PUBLIC' WHERE `isOpen` = true;

-- Step 3: Drop the old isOpen column
ALTER TABLE `EditionShowCall` DROP COLUMN `isOpen`;

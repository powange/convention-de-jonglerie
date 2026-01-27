-- AlterTable
ALTER TABLE `EditionShowCall` ADD COLUMN `askSocialLinks` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `ShowApplication` ADD COLUMN `socialLinks` TEXT NULL;

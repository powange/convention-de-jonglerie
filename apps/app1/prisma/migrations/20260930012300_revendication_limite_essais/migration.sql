-- DropIndex
DROP INDEX `ConventionClaimRequest_code_key` ON `ConventionClaimRequest`;

-- AlterTable
ALTER TABLE `ConventionClaimRequest` ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0;

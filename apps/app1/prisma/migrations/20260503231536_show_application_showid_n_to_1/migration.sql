-- DropForeignKey
ALTER TABLE `ShowApplication` DROP FOREIGN KEY `ShowApplication_showId_fkey`;

-- DropIndex
DROP INDEX `ShowApplication_showId_key` ON `ShowApplication`;

-- AlterTable
ALTER TABLE `SumupConfig` MODIFY `affiliateKey` TEXT NOT NULL;

-- CreateIndex
CREATE INDEX `ShowApplication_showId_idx` ON `ShowApplication`(`showId`);

-- AddForeignKey
ALTER TABLE `ShowApplication` ADD CONSTRAINT `ShowApplication_showId_fkey` FOREIGN KEY (`showId`) REFERENCES `Show`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

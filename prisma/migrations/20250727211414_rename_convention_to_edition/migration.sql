-- DropForeignKey
ALTER TABLE `CarpoolOffer` DROP FOREIGN KEY `CarpoolOffer_conventionId_fkey`;

-- DropForeignKey
ALTER TABLE `CarpoolRequest` DROP FOREIGN KEY `CarpoolRequest_conventionId_fkey`;

-- DropForeignKey
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_creatorId_fkey`;

-- DropForeignKey
ALTER TABLE `ConventionCollaborator` DROP FOREIGN KEY `ConventionCollaborator_conventionId_fkey`;

-- DropForeignKey
ALTER TABLE `_FavoriteConventions` DROP FOREIGN KEY `_FavoriteConventions_A_fkey`;

-- DropForeignKey
ALTER TABLE `_FavoriteConventions` DROP FOREIGN KEY `_FavoriteConventions_B_fkey`;

-- DropIndex
DROP INDEX `CarpoolOffer_conventionId_fkey` ON `CarpoolOffer`;

-- DropIndex
DROP INDEX `CarpoolRequest_conventionId_fkey` ON `CarpoolRequest`;

RENAME TABLE `Convention` TO `Edition`;
RENAME TABLE `_FavoriteConventions` TO `_FavoriteEditions`;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConventionCollaborator` ADD CONSTRAINT `ConventionCollaborator_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolOffer` ADD CONSTRAINT `CarpoolOffer_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarpoolRequest` ADD CONSTRAINT `CarpoolRequest_conventionId_fkey` FOREIGN KEY (`conventionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_FavoriteEditions` ADD CONSTRAINT `_FavoriteEditions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_FavoriteEditions` ADD CONSTRAINT `_FavoriteEditions_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

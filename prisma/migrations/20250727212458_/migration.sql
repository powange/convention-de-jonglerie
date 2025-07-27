-- RedefineIndex
CREATE UNIQUE INDEX `_FavoriteEditions_AB_unique` ON `_FavoriteEditions`(`A`, `B`);
DROP INDEX `_FavoriteConventions_AB_unique` ON `_FavoriteEditions`;

-- RedefineIndex
CREATE INDEX `_FavoriteEditions_B_index` ON `_FavoriteEditions`(`B`);
DROP INDEX `_FavoriteConventions_B_index` ON `_FavoriteEditions`;

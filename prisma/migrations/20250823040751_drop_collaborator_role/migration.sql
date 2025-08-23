/*
  Migration initiale de suppression de la colonne `role`.
  Rendu idempotente pour éviter l'erreur 1091 (Can't DROP ...).
*/

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ConventionCollaborator'
    AND COLUMN_NAME = 'role'
);

SET @ddl := IF(@col_exists > 0,
  'ALTER TABLE `ConventionCollaborator` DROP COLUMN `role`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- No-op si déjà supprimée.

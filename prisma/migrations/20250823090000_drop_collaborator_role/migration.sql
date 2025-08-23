-- Re-introduced migration to drop legacy `role` column after manual legacy script execution
-- This migration is now idempotente: elle ne supprime la colonne `role` que si elle existe encore.
-- Pré-requis (déjà effectués normalement) : npm run migrate:collaborators:legacy

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

-- Fin: si la colonne avait déjà été supprimée par une migration précédente, cette migration devient un no-op.

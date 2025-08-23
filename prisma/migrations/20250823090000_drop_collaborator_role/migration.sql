-- Re-introduced migration to drop legacy `role` column after manual legacy script execution
-- Ensure you have run: npm run migrate:collaborators:legacy (or dry first) and verified data before applying.

ALTER TABLE `ConventionCollaborator` DROP COLUMN `role`;

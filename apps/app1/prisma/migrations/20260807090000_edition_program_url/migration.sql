-- Lien externe vers le programme d'une édition.
--
-- Toutes les conventions ne saisissent pas leur programme ici : beaucoup le tiennent déjà sur leur
-- propre site ou dans un document partagé, et n'ont pas vocation à le recopier ni à le maintenir
-- en double. Ce champ leur permet de le désigner plutôt que de le dupliquer.
--
-- Il coexiste avec `Edition.program` et `EditionProgramDay` sans les remplacer : une édition peut
-- avoir un programme détaillé ici ET renvoyer vers une page plus complète. Aucune contrainte ne
-- l'interdit, aucun des trois n'est prioritaire — c'est l'affichage qui décide quoi montrer.
ALTER TABLE `Edition` ADD COLUMN `programUrl` VARCHAR(191) NULL;

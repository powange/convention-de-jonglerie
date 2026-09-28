-- Rattrapage des lignes existantes : un appel DÉJÀ public a déjà eu sa diffusion aux comptes
-- artiste (plusieurs fois, même, puisque rien ne l'empêchait). On l'inscrit comme notifié, sans
-- quoi le refermer puis le rouvrir déclencherait exactement la diffusion en double que la colonne
-- est là pour supprimer.
--
-- `updatedAt` plutôt que `NOW()` : c'est la date la plus proche de l'ouverture dont on dispose, et
-- elle reste honnête si personne n'a touché l'appel depuis. La valeur ne sert de toute façon qu'à
-- répondre « oui, déjà diffusé ».
--
-- Ce que ce rattrapage NE couvre PAS, faute de trace : un appel qui a été public, a été refermé, et
-- serait rouvert. Il rediffusera une fois, puis plus jamais. Les notifications déjà envoyées ne
-- portent pas l'identifiant de l'appel, il n'y a donc rien à interroger pour le distinguer d'un
-- appel qui n'a jamais été ouvert.
UPDATE `EditionShowCall`
SET `openedNotifiedAt` = `updatedAt`
WHERE `visibility` = 'PUBLIC' AND `openedNotifiedAt` IS NULL;

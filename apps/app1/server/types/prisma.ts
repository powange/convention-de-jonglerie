/**
 * Les types du client Prisma, par une seule porte.
 *
 * Importer depuis `@prisma/client` ne fonctionne pas ici : ce paquet réexporte `.prisma/client`,
 * qui n'existe pas puisque le client est généré dans `server/generated/prisma`. Le compilateur n'y
 * trouvait donc ni `Prisma`, ni `User`, ni aucun modèle — vingt-deux fichiers dans ce cas, dont
 * les types se dégradaient silencieusement.
 *
 * `export type *` : rien de ce fichier n'existe à l'exécution. Il ne crée aucune dépendance vers
 * le client lui-même, qui reste instancié dans `#server/utils/prisma`.
 */
export type * from '../generated/prisma/client'

/**
 * Les types du client Prisma, par une seule porte — même rôle que dans app1 : le layer bénévoles
 * importe `#server/types/prisma`. `export type *` : rien n'existe à l'exécution.
 */
export type * from '../generated/prisma/client'

import type { User } from '#server/types/prisma'

/**
 * Type minimaliste pour l'utilisateur dans les vérifications de permissions
 * Permet d'accepter aussi bien un User Prisma complet qu'un AuthenticatedUser
 */
export type UserForPermissions = Pick<User, 'id' | 'isGlobalAdmin'>

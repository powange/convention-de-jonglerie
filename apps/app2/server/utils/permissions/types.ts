import type { User } from '#server/types/prisma'

/**
 * L'utilisateur tel que les vérifications de droits le reçoivent (contrat d'hôte des layers, même
 * type qu'app1) : un `User` complet comme un utilisateur de session conviennent.
 */
export type UserForPermissions = Pick<User, 'id' | 'isGlobalAdmin'>

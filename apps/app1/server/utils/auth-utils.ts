import type { User } from '@prisma/client'

/**
 * Type pour l'utilisateur dans le contexte des événements
 */
export type AuthenticatedUser = Pick<User, 'id' | 'email' | 'pseudo' | 'isGlobalAdmin'> & {
  isGlobalAdmin?: boolean
}

/**
 * Vérifie que l'utilisateur est authentifié et retourne l'utilisateur
 * @param event L'événement Nuxt/Nitro
 * @returns L'utilisateur authentifié
 * @throws createError 401 si non authentifié
 */
export function requireAuth(event: any): AuthenticatedUser {
  if (!event.context.user) {
    throw createError({
      status: 401,
      message: 'Unauthorized',
    })
  }

  return event.context.user as AuthenticatedUser
}

/**
 * Vérifie optionnellement l'authentification (retourne null si pas authentifié)
 * @param event L'événement Nuxt/Nitro
 * @returns L'utilisateur authentifié ou null
 */
export function optionalAuth(event: any): AuthenticatedUser | null {
  return (event.context.user as AuthenticatedUser) || null
}

/**
 * Vérifie que l'utilisateur est soit l'utilisateur spécifié, soit un admin global
 * @param event L'événement Nuxt/Nitro
 * @param userId L'ID de l'utilisateur autorisé
 * @returns L'utilisateur authentifié
 * @throws createError si pas autorisé
 */
export function requireUserOrGlobalAdmin(event: any, userId: number): AuthenticatedUser {
  const user = requireAuth(event)

  if (user.id !== userId && !user.isGlobalAdmin) {
    throw createError({
      status: 403,
      message: 'Accès non autorisé',
    })
  }

  return user
}

/**
 * Type pour une ressource possédant un userId
 */
export interface OwnedResource {
  userId: number
}

/**
 * Options pour la vérification de propriété de ressource
 */
export interface RequireResourceOwnerOptions {
  /** Permet aux admins globaux d'accéder à la ressource */
  allowGlobalAdmin?: boolean
  /** Message d'erreur personnalisé */
  errorMessage?: string
}

/**
 * Vérifie que l'utilisateur authentifié est le propriétaire de la ressource
 *
 * @param event L'événement Nuxt/Nitro
 * @param resource La ressource avec un champ userId
 * @param options Options de vérification
 * @returns L'utilisateur authentifié
 * @throws createError 403 si pas propriétaire
 *
 * @example
 * const offer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {...})
 * requireResourceOwner(event, offer, {
 *   errorMessage: "Vous n'avez pas les droits pour supprimer cette offre"
 * })
 */
export function requireResourceOwner<T extends OwnedResource>(
  event: any,
  resource: T,
  options: RequireResourceOwnerOptions = {}
): AuthenticatedUser {
  const { allowGlobalAdmin = false, errorMessage = 'Accès non autorisé' } = options

  const user = requireAuth(event)

  if (resource.userId === user.id) {
    return user
  }

  if (allowGlobalAdmin && user.isGlobalAdmin) {
    return user
  }

  throw createError({
    status: 403,
    message: errorMessage,
  })
}

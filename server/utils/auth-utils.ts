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
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  return event.context.user as AuthenticatedUser
}

/**
 * Vérifie que l'utilisateur est authentifié et est un admin global
 * @param event L'événement Nuxt/Nitro
 * @returns L'utilisateur admin authentifié
 * @throws createError 401 si non authentifié ou 403 si pas admin
 */
export function requireGlobalAdmin(event: any): AuthenticatedUser {
  const user = requireAuth(event)

  if (!user.isGlobalAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Accès réservé aux administrateurs',
    })
  }

  return user
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
 * Vérifie que l'utilisateur est authentifié ou est un admin global
 * Utile pour les endpoints qui ont des permissions différentes selon le rôle
 * @param event L'événement Nuxt/Nitro
 * @returns L'utilisateur avec information isGlobalAdmin garantie
 */
export function requireAuthWithAdminCheck(
  event: any
): AuthenticatedUser & { isGlobalAdmin: boolean } {
  const user = requireAuth(event)
  return {
    ...user,
    isGlobalAdmin: user.isGlobalAdmin || false,
  }
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
      statusCode: 403,
      message: 'Accès non autorisé',
    })
  }

  return user
}

/**
 * Messages d'erreur d'authentification standardisés
 */
export const AUTH_ERRORS = {
  NOT_AUTHENTICATED: 'Unauthorized',
  UNAUTHORIZED: 'Unauthorized', // Pour l'API anglaise
  FORBIDDEN: 'Accès non autorisé',
  ADMIN_ONLY: 'Accès réservé aux administrateurs',
  INSUFFICIENT_RIGHTS: 'Droits insuffisants',
} as const

/**
 * Crée une erreur d'authentification standardisée
 * @param type Le type d'erreur
 * @param customMessage Message personnalisé optionnel
 */
export function createAuthError(type: keyof typeof AUTH_ERRORS, customMessage?: string) {
  const statusCode = type === 'NOT_AUTHENTICATED' || type === 'UNAUTHORIZED' ? 401 : 403

  throw createError({
    statusCode,
    message: customMessage || AUTH_ERRORS[type],
  })
}

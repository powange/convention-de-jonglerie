import { isHttpError } from '@@/server/types/api'
import { z } from 'zod'

import { isApiError, toApiError } from './errors'
import { handleValidationError } from './validation-schemas'

import type { ApiSuccessResponse, ApiPaginatedResponse } from '@@/server/types/api'
import type { H3Event, EventHandlerRequest } from 'h3'

/**
 * Options pour le wrapper d'API
 */
export interface ApiHandlerOptions {
  /**
   * Nom de l'opération pour les logs (optionnel)
   */
  operationName?: string

  /**
   * Désactiver les logs d'erreur (pour les erreurs attendues)
   */
  silentErrors?: boolean

  /**
   * Message d'erreur par défaut pour les erreurs 500
   */
  defaultErrorMessage?: string
}

/**
 * Wrapper standardisé pour les handlers d'API
 * Gère automatiquement les erreurs HTTP, Zod et génériques
 *
 * @example
 * export default wrapApiHandler(async (event) => {
 *   const user = requireAuth(event)
 *   return { success: true }
 * })
 */
export function wrapApiHandler<T = any>(
  handler: (event: H3Event<EventHandlerRequest>) => Promise<T> | T,
  options: ApiHandlerOptions = {}
) {
  const {
    operationName,
    silentErrors = false,
    defaultErrorMessage = 'Erreur serveur interne',
  } = options

  return defineEventHandler<EventHandlerRequest>(async (event) => {
    try {
      return await handler(event)
    } catch (error: unknown) {
      // 1. Erreurs HTTP (h3) - les relancer directement
      if (isHttpError(error)) {
        throw error
      }

      // 2. Erreurs ApiError (nos classes personnalisées) - convertir en erreur h3
      if (isApiError(error)) {
        throw createError({
          status: error.statusCode,
          message: error.message,
        })
      }

      // 3. Erreurs Zod - transformer en erreur 400
      if (error instanceof z.ZodError) {
        return handleValidationError(error)
      }

      // 4. Erreurs génériques - logger et transformer en 500
      const isUserError = isHttpError(error) || isApiError(error)
      const shouldLog =
        !silentErrors && (!isUserError || (isApiError(error) && error.statusCode >= 500))

      if (shouldLog) {
        const prefix = operationName ? `[${operationName}]` : ''
        console.error(`${prefix} Erreur inattendue:`, error)
      }

      // Convertir en ApiError puis en erreur h3
      const apiError = toApiError(error, defaultErrorMessage)
      throw createError({
        status: apiError.statusCode,
        message: apiError.message,
      })
    }
  })
}

/**
 * Gère les erreurs Prisma courantes (notamment P2002 - contrainte unique)
 * Convertit les erreurs Prisma en erreurs API standardisées
 */
export function handlePrismaError(error: unknown, context?: string): never {
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: any }

    switch (prismaError.code) {
      case 'P2002': {
        // Contrainte unique violée
        const target = prismaError.meta?.target
        const field = Array.isArray(target) ? target[0] : 'champ'
        // Convertir en erreur h3 (pour rester compatible)
        throw createError({
          status: 409,
          message: `Ce ${field} est déjà utilisé`,
        })
      }

      case 'P2025': {
        // Enregistrement non trouvé
        throw createError({
          status: 404,
          message: context ? `${context} introuvable` : 'Ressource introuvable',
        })
      }

      case 'P2003': {
        // Contrainte de clé étrangère violée
        throw createError({
          status: 400,
          message: 'Référence invalide',
        })
      }

      default:
        // Erreur Prisma inconnue - logger et relancer comme 500
        console.error('Erreur Prisma non gérée:', prismaError.code, prismaError)
        throw createError({
          status: 500,
          message: 'Erreur de base de données',
        })
    }
  }

  // Si ce n'est pas une erreur Prisma reconnue, la relancer
  throw error
}

/**
 * Crée une réponse de succès standardisée
 * @template T - Type des données retournées
 * @param data - Données à retourner
 * @param message - Message optionnel de succès
 * @returns Réponse API typée
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    ...(message && { message }),
    data,
  }
}

/**
 * Crée une réponse paginée standardisée
 * @template T - Type des items dans le tableau
 * @param items - Tableau d'items à retourner
 * @param total - Nombre total d'items (pour la pagination)
 * @param page - Numéro de page actuelle
 * @param limit - Nombre d'items par page
 * @returns Réponse API paginée typée
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): ApiPaginatedResponse<T> {
  return {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      totalCount: total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  }
}

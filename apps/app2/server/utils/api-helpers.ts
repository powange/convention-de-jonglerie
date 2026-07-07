import { z } from 'zod'

import { isApiError, toApiError } from './errors'
import { handleValidationError } from './validation-schemas'

import type { ApiSuccessResponse } from '../types/api'
import type { H3Event, EventHandlerRequest } from 'h3'

import { isHttpError } from '../types/api'

/**
 * Options pour le wrapper d'API
 */
export interface ApiHandlerOptions {
  /** Nom de l'opération pour les logs (optionnel) */
  operationName?: string
  /** Désactiver les logs d'erreur (pour les erreurs attendues) */
  silentErrors?: boolean
  /** Message d'erreur par défaut pour les erreurs 500 */
  defaultErrorMessage?: string
}

/**
 * Wrapper standardisé pour les handlers d'API.
 * Gère automatiquement les erreurs HTTP, Zod et génériques.
 *
 * @example
 * export default wrapApiHandler(async (event) => {
 *   return createSuccessResponse({ ok: true })
 * }, { operationName: 'Example' })
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
      // 1. Erreurs ApiError (nos classes personnalisées) - convertir en erreur h3
      // Vérifier ApiError AVANT HttpError car isHttpError matche aussi les objets avec status
      if (isApiError(error)) {
        throw createError({
          status: error.status,
          message: error.message,
          cause: error,
        })
      }

      // 2. Erreurs HTTP (h3) - les relancer directement
      if (isHttpError(error)) {
        throw error
      }

      // 3. Erreurs Zod - transformer en erreur 400
      if (error instanceof z.ZodError) {
        return handleValidationError(error)
      }

      // 4. Erreurs génériques - logger et transformer en 500
      const isUserError = isHttpError(error) || isApiError(error)
      const shouldLog =
        !silentErrors && (!isUserError || (isApiError(error) && error.status >= 500))

      if (shouldLog) {
        const prefix = operationName ? `[${operationName}]` : ''
        console.error(`${prefix} Erreur inattendue:`, error)
      }

      const apiError = toApiError(error, defaultErrorMessage)
      throw createError({
        status: apiError.status,
        message: apiError.message,
        cause: error,
      })
    }
  })
}

/**
 * Crée une réponse de succès standardisée.
 * @template T - Type des données retournées
 * @param data - Données à retourner
 * @param message - Message optionnel de succès
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    ...(message && { message }),
    data,
  }
}

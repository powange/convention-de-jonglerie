import { z } from 'zod'

import { isApiError, toApiError } from './errors'
import { handleValidationError } from './validation-schemas'

import type { ApiSuccessResponse, ApiPaginatedResponse } from '#server/types/api'
import type { H3Event, EventHandlerRequest } from 'h3'

import { isHttpError } from '#server/types/api'

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
      // 1. Erreurs ApiError (nos classes personnalisées) - convertir en erreur h3
      // Note: Vérifier ApiError AVANT HttpError car isHttpError matche aussi les objets avec status
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

      /*
       * 4. Erreurs Prisma CONNUES — les traduire plutôt que les rendre en 500.
       *
       * ## ⚠️ POURQUOI CETTE ÉTAPE N'EXISTAIT PAS (constat A7)
       *
       * `handlePrismaError` traduit P2002 en 409, P2025 en 404 et P2003 en 400 depuis longtemps.
       * Aucun des 552 handlers ne l'appelait — zéro usage mesuré. Partout, une contrainte unique ou
       * une clé étrangère violée traversait ce wrapper comme erreur générique : **500**, message
       * neutre, ligne de journal en « erreur inattendue », et pour l'utilisateur un « Erreur serveur
       * interne » là où « déjà existant » ou « référence invalide » l'orienterait.
       *
       * 📍 C'est le cas le plus coûteux de code mort : il était **testé** — huit cas — donc il avait
       * l'air vivant, et il le restait tant qu'on jugeait sur la couverture.
       *
       * ⚠️ SEULS LES CODES CONNUS SONT DÉLÉGUÉS. Tout déléguer ferait perdre aux codes inconnus le
       * journal « erreur inattendue » avec son `operationName` — c'est-à-dire la seule trace qui
       * permette de retrouver l'appel fautif. Un code Prisma qu'on n'a pas prévu doit rester une
       * surprise bruyante.
       */
      if (estUneErreurPrismaTraduisible(error)) {
        handlePrismaError(error, operationName)
      }

      // 5. Erreurs génériques - logger et transformer en 500
      const isUserError = isHttpError(error) || isApiError(error)
      const shouldLog =
        !silentErrors && (!isUserError || (isApiError(error) && error.status >= 500))

      if (shouldLog) {
        const prefix = operationName ? `[${operationName}]` : ''
        console.error(`${prefix} Erreur inattendue:`, error)
      }

      // Convertir en ApiError puis en erreur h3
      // On conserve l'erreur d'origine via `cause` pour que le logger
      // enregistre le vrai message/stack plutôt que le message générique.
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
 * Les codes Prisma que `handlePrismaError` sait traduire en refus explicite.
 *
 * ⚠️ La liste est FERMÉE, et c'est le point : un code absent d'ici garde le chemin générique, donc
 * son journal « erreur inattendue » et son `operationName`. Ajouter un code ici, c'est accepter de
 * perdre cette trace en échange d'un message utile — ce qui se décide code par code.
 */
const CODES_PRISMA_TRADUITS = ['P2002', 'P2025', 'P2003'] as const

/** Une erreur Prisma dont on sait faire un refus plutôt qu'une panne. */
export function estUneErreurPrismaTraduisible(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return (CODES_PRISMA_TRADUITS as readonly string[]).includes(
    String((error as { code: unknown }).code)
  )
}

/**
 * Gère les erreurs Prisma courantes (notamment P2002 - contrainte unique)
 * Convertit les erreurs Prisma en erreurs API standardisées
 *
 * Branché dans `wrapApiHandler` : les handlers n'ont pas à l'appeler eux-mêmes. Ceux qui traitent
 * déjà P2002 à la main (sept fichiers) gardent leur message, puisque l'erreur HTTP qu'ils lèvent
 * est reconnue plus tôt dans la chaîne.
 */
export function handlePrismaError(error: unknown, context?: string): never {
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: any }

    switch (prismaError.code) {
      case 'P2002': {
        /*
         * Contrainte unique violée.
         *
         * ⚠️ LE NOM DE COLONNE NE PART PLUS DANS LE MESSAGE. Il rendait « Ce editionId_name est
         * déjà utilisé » : le nom de l'index Prisma, lisible par personne, et une fuite du schéma
         * dans une réponse d'API. Le champ reste disponible dans `data` pour qui veut l'afficher.
         */
        const target = prismaError.meta?.target
        const champ = Array.isArray(target) ? target.join(', ') : (target ?? null)
        throw createError({
          status: 409,
          message: 'Cette valeur est déjà utilisée',
          data: { champ },
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
          cause: error,
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

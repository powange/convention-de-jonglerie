/**
 * Types standardisés pour les réponses API
 *
 * Ces types garantissent une structure cohérente pour toutes les réponses API
 * et facilitent la création de clients typés côté frontend.
 */

/**
 * Structure de pagination standardisée
 */
export interface ApiPagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

/**
 * Réponse API de succès générique
 * @template T - Type des données retournées
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  message?: string
  data: T
}

/**
 * Réponse API paginée
 * @template T - Type des items dans le tableau
 */
export interface ApiPaginatedResponse<T = unknown> {
  success: true
  data: T[]
  pagination: ApiPagination
}

/**
 * Réponse API d'erreur
 */
export interface ApiErrorResponse {
  success: false
  statusCode: number
  message: string
  operationName?: string
  data?: unknown
}

/**
 * Union de tous les types de réponse API possibles
 * @template T - Type des données en cas de succès
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Type pour les réponses paginées ou normales
 * @template T - Type des données
 */
export type ApiDataResponse<T = unknown> = ApiSuccessResponse<T> | ApiPaginatedResponse<T>

/**
 * Type pour les erreurs HTTP avec code de statut
 * Extension de l'objet Error standard avec status (Nuxt 5) ou statusCode (legacy)
 */
export interface HttpError extends Error {
  status?: number
  statusCode?: number
  data?: unknown
}

/**
 * Type guard pour vérifier si une erreur est une HttpError
 * @param error - L'erreur à vérifier
 * @returns true si l'erreur a un status ou statusCode numérique
 */
export function isHttpError(error: unknown): error is HttpError {
  if (typeof error !== 'object' || error === null) return false
  const err = error as Record<string, unknown>
  return typeof err.status === 'number' || typeof err.statusCode === 'number'
}

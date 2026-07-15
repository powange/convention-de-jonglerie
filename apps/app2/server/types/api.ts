/**
 * Types standardisés (minimaux) pour les réponses API d'app2.
 *
 * Sous-ensemble du contrat app1 nécessaire au layer `layers/auth/` :
 * seuls `ApiSuccessResponse` et `isHttpError` sont consommés.
 */

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
 * Type pour les erreurs HTTP avec code de statut.
 * Extension de l'objet Error standard avec `status` (Nuxt/h3 récent) ou `statusCode` (legacy).
 */
export interface HttpError extends Error {
  status?: number
  statusCode?: number
  data?: unknown
}

/**
 * Type guard : vérifie si une erreur est une HttpError (possède status/statusCode numérique).
 */
export function isHttpError(error: unknown): error is HttpError {
  if (typeof error !== 'object' || error === null) return false
  const err = error as Record<string, unknown>
  return typeof err.status === 'number' || typeof err.statusCode === 'number'
}

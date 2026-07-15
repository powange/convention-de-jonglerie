/**
 * Classes d'erreur standardisées pour l'API (version minimale app2).
 *
 * Seuls `ApiError`, `InternalServerError`, `isApiError` et `toApiError` sont
 * requis par `wrapApiHandler` (api-helpers.ts).
 */

/**
 * Classe de base pour toutes les erreurs API
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public operationName?: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'ApiError'
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Erreur 500 - Internal Server Error
 */
export class InternalServerError extends ApiError {
  constructor(message = 'Erreur serveur interne', options?: { cause?: unknown }) {
    super(500, message, undefined, options)
    this.name = 'InternalServerError'
  }
}

/**
 * Vérifie si une erreur est une instance d'ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * Convertit une erreur quelconque en ApiError.
 * Utilise toujours le defaultMessage pour éviter d'exposer des détails techniques ;
 * l'erreur d'origine est conservée via `cause` pour le logging.
 */
export function toApiError(error: unknown, defaultMessage = 'Erreur serveur interne'): ApiError {
  if (isApiError(error)) {
    return error
  }
  return new InternalServerError(defaultMessage, { cause: error })
}

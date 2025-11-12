/**
 * Classes d'erreur standardisées pour l'API
 *
 * Ces classes permettent de créer des erreurs typées avec des codes HTTP appropriés
 * et des messages cohérents à travers toute l'application.
 */

/**
 * Classe de base pour toutes les erreurs API
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public operationName?: string
  ) {
    super(message)
    this.name = 'ApiError'
    // Maintenir la stack trace correcte
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Erreur 400 - Bad Request
 * Utilisée pour les erreurs de validation ou de paramètres invalides
 */
export class BadRequestError extends ApiError {
  constructor(message = 'Requête invalide') {
    super(400, message)
    this.name = 'BadRequestError'
  }
}

/**
 * Erreur 401 - Unauthorized
 * Utilisée quand l'authentification est requise mais absente ou invalide
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentification requise') {
    super(401, message)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Erreur 403 - Forbidden
 * Utilisée quand l'utilisateur est authentifié mais n'a pas les permissions nécessaires
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Action non autorisée') {
    super(403, message)
    this.name = 'ForbiddenError'
  }
}

/**
 * Erreur 404 - Not Found
 * Utilisée quand une ressource demandée n'existe pas
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} non trouvé(e)`)
    this.name = 'NotFoundError'
  }
}

/**
 * Erreur 409 - Conflict
 * Utilisée pour les conflits de données (ex: contrainte unique violée)
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message)
    this.name = 'ConflictError'
  }
}

/**
 * Erreur 422 - Unprocessable Entity
 * Utilisée pour les erreurs de validation métier
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors?: Record<string, string[]>
  ) {
    super(422, message)
    this.name = 'ValidationError'
  }
}

/**
 * Erreur 500 - Internal Server Error
 * Utilisée pour les erreurs serveur inattendues
 */
export class InternalServerError extends ApiError {
  constructor(message = 'Erreur serveur interne') {
    super(500, message)
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
 * Convertit une erreur quelconque en ApiError
 * Utile pour normaliser les erreurs avant de les retourner au client
 *
 * Note: Utilise toujours le defaultMessage pour éviter d'exposer des détails techniques
 */
export function toApiError(error: unknown, defaultMessage = 'Erreur serveur interne'): ApiError {
  if (isApiError(error)) {
    return error
  }

  // Toujours utiliser le defaultMessage pour les erreurs génériques
  // afin d'éviter d'exposer des détails techniques au client
  return new InternalServerError(defaultMessage)
}

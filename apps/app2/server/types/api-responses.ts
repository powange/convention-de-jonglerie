/**
 * Types de réponse API dépendants du domaine (app2).
 *
 * Version minimale : seul `LoginResponse` est requis par `layers/auth/` (login.post.ts
 * l'utilise via `wrapApiHandler<ApiSuccessResponse<LoginResponse>>`).
 */

/**
 * Réponse de connexion : l'utilisateur authentifié.
 * Le type est volontairement permissif (index signature) pour rester compatible
 * avec la forme complète retournée par login.post.ts.
 */
export interface LoginResponse {
  user: {
    id: number
    email: string
    pseudo?: string | null
    nom?: string | null
    prenom?: string | null
    [key: string]: unknown
  }
}

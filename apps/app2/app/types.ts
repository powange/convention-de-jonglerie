// Types front partagés d'app2, consommés par le layer d'auth via l'alias `~/types`.

/**
 * Représentation de l'utilisateur connecté côté client.
 *
 * Volontairement souple : le layer d'auth affecte parfois un sous-ensemble de
 * champs (ex. `{ id, email }` après vérification d'email) et fusionne des
 * réponses d'API arbitraires via `authStore.updateUser`. La signature d'index
 * autorise ces champs additionnels sans casser le typage.
 */
export interface AuthUser {
  id: number
  email: string
  name?: string | null
  pseudo?: string | null
  nom?: string | null
  prenom?: string | null
  isEmailVerified?: boolean
  isVolunteer?: boolean
  isArtist?: boolean
  isOrganizer?: boolean
  [key: string]: unknown
}

/**
 * Structure d'erreur HTTP renvoyée par `$fetch` / `createError`.
 *
 * Utilisée par les pages du layer d'auth pour lire `statusCode`/`status`,
 * `message` et `data.message` afin d'afficher des messages d'erreur adaptés.
 */
export interface HttpError {
  status?: number
  statusCode?: number
  message?: string
  data?: {
    message?: string
    statusMessage?: string
    errors?: Record<string, string>
    [key: string]: unknown
  }
}

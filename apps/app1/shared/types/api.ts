/**
 * Types API partagés entre client et serveur
 *
 * Ce fichier contient les types de réponse API indépendants de Prisma,
 * utilisables depuis app/ et server/ via `#shared/types/api`.
 *
 * Les types dépendants de Prisma restent dans server/types/api-responses.ts.
 */

// ============================================================================
// TYPES UTILISATEUR (réponses API)
// ============================================================================

/**
 * Utilisateur retourné après login ou dans la session
 */
export interface SessionUser {
  id: number
  email: string
  pseudo: string
  nom: string | null
  prenom: string | null
  phone: string | null
  profilePicture: string | null
  isGlobalAdmin: boolean
  isVolunteer: boolean
  isArtist: boolean
  isOrganizer: boolean
  createdAt: Date
  updatedAt: Date
  isEmailVerified: boolean
}

/**
 * Utilisateur complet retourné par /api/session/me
 */
export interface SessionMeUser {
  id: number
  email: string
  emailHash: string
  pseudo: string
  nom: string | null
  prenom: string | null
  phone: string | null
  profilePicture: string | null
  isGlobalAdmin: boolean
  isVolunteer: boolean
  isArtist: boolean
  isOrganizer: boolean
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// RÉPONSES AUTHENTIFICATION
// ============================================================================

/**
 * POST /api/auth/login
 */
export interface LoginResponse {
  user: SessionUser
}

/**
 * GET /api/session/me
 */
export interface SessionMeResponse {
  user: SessionMeUser
  impersonation: {
    originalUserId: number
    originalPseudo: string
    impersonatedAt: string
  } | null
}

// ============================================================================
// RÉPONSES PROFIL
// ============================================================================

/**
 * GET /api/profile/stats
 */
export interface ProfileStats {
  conventionsCreated: number
  editionsFavorited: number
  favoritesReceived: number
}

// ============================================================================
// RÉPONSES GÉNÉRIQUES
// ============================================================================

/**
 * Réponse de suppression standard
 */
export interface DeleteResponse {
  success: true
  message: string
}

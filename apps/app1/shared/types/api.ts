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
  /**
   * L'adresse DEMANDÉE et pas encore confirmée.
   *
   * ⚠️ Ce champ MANQUAIT à cette interface alors que `session/me.get.ts` le sélectionne et le
   * renvoie — et que son propre commentaire explique pourquoi : « sans ce champ, l'écran du profil
   * ne pourrait pas rappeler qu'un changement est en cours ». Le contrat déclaré omettait donc un
   * champ dont l'absence casse un écran, ce qui est l'inverse de ce qu'un contrat doit faire.
   *
   * 📍 Le client le lisait en contournant le type — `(authStore.user as any)?.pendingEmail`, à
   * trois endroits de `profile/informations.vue`. Ces `as any` sont le symptôme : on ne caste pas
   * un champ qui est déclaré.
   *
   * 📍 Et il est apparu en corrigeant `impersonation` : une fois ce champ-là honnête, le
   * compilateur a pu désigner le suivant. Une fiction en masquait une autre.
   */
  pendingEmail: string | null
  pseudo: string
  nom: string | null
  prenom: string | null
  phone: string | null
  /** Les pronoms affichés à côté du nom. Sélectionné et renvoyé, comme `pendingEmail`. */
  pronouns: string | null
  profilePicture: string | null
  isGlobalAdmin: boolean
  isVolunteer: boolean
  isArtist: boolean
  isOrganizer: boolean
  /**
   * La langue choisie dans le profil, appliquée à l'hydratation de la session.
   *
   * Nullable : un compte ancien, ou créé par OAuth, peut n'avoir rien choisi — et l'interface
   * reste alors sur la langue détectée par le navigateur.
   */
  preferredLanguage: string | null
  /** Informations personnelles facultatives renseignées depuis le profil. */
  dietaryPreference: 'NONE' | 'VEGETARIAN' | 'VEGAN'
  allergies: string | null
  allergySeverity: 'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL' | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
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
/**
 * L'emprunt d'identité en cours, tel que le serveur le RANGE et le RENVOIE.
 *
 * ## ⚠️ CETTE FORME ÉTAIT UNE FICTION
 *
 * `SessionMeResponse.impersonation` déclarait `{ originalUserId, originalPseudo, impersonatedAt }`
 * — trois champs dont **deux n'existent nulle part**. Le serveur renvoie l'objet rangé par
 * `setImpersonationCookie`, qui porte `originalUserPseudo` et `startedAt` ; le magasin client lit
 * ces mêmes noms. Le contrat déclaré ne décrivait donc ni ce qui est produit, ni ce qui est
 * consommé.
 *
 * 📍 Et personne ne s'en est aperçu parce que les deux bouts le contournent :
 * `initFromSession(sessionData: any)` côté client, et un retour non vérifié côté serveur. C'est
 * exactement pourquoi le compilateur n'avait rien d'utile à dire ici — on ne lui avait rien donné
 * de vrai à comparer.
 *
 * ⚠️ `originalUserNom` et `originalUserPrenom` sont NULLABLES : `User.nom` et `User.prenom` sont
 * `String?` en base. La déclaration ambiante de `#auth-utils` les annonçait non nuls, ce qui était
 * un second mensonge — moins visible, mais du même ordre.
 */
export interface SessionImpersonation {
  active: boolean
  originalUserId: number
  originalUserEmail: string
  originalUserPseudo: string
  originalUserNom: string | null
  originalUserPrenom: string | null
  targetUserId: number
  targetUserEmail: string
  startedAt: string
}

export interface SessionMeResponse {
  user: SessionMeUser
  impersonation: SessionImpersonation | null
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

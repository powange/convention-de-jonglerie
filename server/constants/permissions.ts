/**
 * Constantes centralisées pour les droits d'organisateurs
 * Ces constantes sont utilisées dans :
 * - Les permissions de conventions (ConventionOrganizer)
 * - Les permissions d'éditions (EditionOrganizerPermission)
 * - Les vérifications de droits d'accès
 */

/**
 * Droits d'organisateur au niveau convention
 * Peuvent être accordés aux organisateurs via ConventionOrganizer
 */
export const ORGANIZER_RIGHTS = {
  // Gestion de la convention
  EDIT_CONVENTION: 'canEditConvention',
  DELETE_CONVENTION: 'canDeleteConvention',
  MANAGE_ORGANIZERS: 'canManageOrganizers',

  // Gestion des éditions
  ADD_EDITION: 'canAddEdition',
  EDIT_ALL_EDITIONS: 'canEditAllEditions',
  DELETE_ALL_EDITIONS: 'canDeleteAllEditions',

  // Gestion des ressources
  MANAGE_VOLUNTEERS: 'canManageVolunteers',
  MANAGE_ARTISTS: 'canManageArtists',
  MANAGE_MEALS: 'canManageMeals',
  MANAGE_TICKETING: 'canManageTicketing',
} as const

/**
 * Type union de tous les droits possibles
 */
export type OrganizerRight = (typeof ORGANIZER_RIGHTS)[keyof typeof ORGANIZER_RIGHTS]

/**
 * Liste de tous les droits d'organisateur (pour itérations)
 */
export const ALL_ORGANIZER_RIGHTS = Object.values(ORGANIZER_RIGHTS)

/**
 * Type pour une map de permissions (toutes les permissions avec valeurs booléennes)
 */
export type OrganizerPermissions = {
  [K in OrganizerRight]: boolean
}

/**
 * Type pour une map de permissions partielle (optionnelle)
 */
export type PartialOrganizerPermissions = {
  [K in OrganizerRight]?: boolean
}

/**
 * Droits liés à la gestion des conventions
 */
export const CONVENTION_RIGHTS = [
  ORGANIZER_RIGHTS.EDIT_CONVENTION,
  ORGANIZER_RIGHTS.DELETE_CONVENTION,
  ORGANIZER_RIGHTS.MANAGE_ORGANIZERS,
] as const

/**
 * Droits liés à la gestion des éditions
 */
export const EDITION_RIGHTS = [
  ORGANIZER_RIGHTS.ADD_EDITION,
  ORGANIZER_RIGHTS.EDIT_ALL_EDITIONS,
  ORGANIZER_RIGHTS.DELETE_ALL_EDITIONS,
] as const

/**
 * Droits liés à la gestion des ressources
 */
export const RESOURCE_RIGHTS = [
  ORGANIZER_RIGHTS.MANAGE_VOLUNTEERS,
  ORGANIZER_RIGHTS.MANAGE_ARTISTS,
  ORGANIZER_RIGHTS.MANAGE_MEALS,
  ORGANIZER_RIGHTS.MANAGE_TICKETING,
] as const

/**
 * Vérifie si une chaîne de caractères est un droit d'organisateur valide
 */
export function isOrganizerRight(value: string): value is OrganizerRight {
  return ALL_ORGANIZER_RIGHTS.includes(value as OrganizerRight)
}

/**
 * Crée une map de permissions vide (toutes à false)
 */
export function createEmptyPermissions(): OrganizerPermissions {
  return Object.values(ORGANIZER_RIGHTS).reduce((acc, right) => {
    acc[right] = false
    return acc
  }, {} as OrganizerPermissions)
}

/**
 * Crée une map de permissions avec tous les droits activés
 */
export function createFullPermissions(): OrganizerPermissions {
  return Object.values(ORGANIZER_RIGHTS).reduce((acc, right) => {
    acc[right] = true
    return acc
  }, {} as OrganizerPermissions)
}

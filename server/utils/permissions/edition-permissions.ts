import type { OrganizerRight } from '#server/constants/permissions'
import type { UserForPermissions } from './types'
import type {
  User,
  Edition,
  Convention,
  ConventionOrganizer,
  EditionOrganizerPermission,
} from '@prisma/client'

import { ORGANIZER_RIGHTS } from '#server/constants/permissions'
import { checkAdminMode } from '#server/utils/organizer-management'

/**
 * Type pour une édition avec ses relations nécessaires aux permissions
 */
export type EditionWithPermissions = Edition & {
  convention: Convention & {
    organizers: ConventionOrganizer[]
  }
  organizerPermissions?: (EditionOrganizerPermission & {
    organizer: {
      userId: number
    }
  })[]
}

/**
 * Options pour récupérer une édition avec ses permissions
 */
export interface EditionPermissionOptions {
  userId: number
  requiredRights?: OrganizerRight[]
}

/**
 * @deprecated Importez OrganizerRight depuis #server/constants/permissions
 * Ce type est conservé pour rétrocompatibilité mais ne devrait plus être utilisé
 */
export type { OrganizerRight }

/**
 * Récupère une édition avec les organisateurs filtrés selon les droits requis
 */
export async function getEditionWithPermissions(
  editionId: number,
  options: EditionPermissionOptions
): Promise<EditionWithPermissions | null> {
  const { userId, requiredRights = [] } = options

  // Si aucun droit spécifique requis, on récupère tous les organisateurs de l'utilisateur
  const organizerFilter =
    requiredRights.length > 0
      ? {
          userId,
          OR: requiredRights.map((right) => ({ [right]: true })),
        }
      : { userId }

  return await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: {
            where: organizerFilter,
          },
        },
      },
      organizerPermissions: {
        include: {
          organizer: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  })
}

/**
 * Vérifie si un utilisateur peut éditer une édition
 */
export function canEditEdition(edition: EditionWithPermissions, user: UserForPermissions): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits d'édition au niveau convention
  const hasConventionEditRights =
    edition.convention.organizers?.some(
      (collab) =>
        collab.userId === user.id && (collab.canEditAllEditions || collab.canEditConvention)
    ) || false

  // Vérifier si l'utilisateur a des droits d'édition spécifiques à cette édition
  const hasEditionEditRights =
    edition.organizerPermissions?.some(
      (perm) => perm.organizer.userId === user.id && perm.canEdit === true
    ) || false

  return (
    isCreator ||
    isConventionAuthor ||
    hasConventionEditRights ||
    hasEditionEditRights ||
    isGlobalAdmin
  )
}

/**
 * Vérifie si un utilisateur peut supprimer une édition
 */
export function canDeleteEdition(
  edition: EditionWithPermissions,
  user: UserForPermissions
): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits de suppression au niveau convention
  const hasConventionDeleteRights =
    edition.convention.organizers?.some(
      (collab) =>
        collab.userId === user.id && (collab.canDeleteAllEditions || collab.canDeleteConvention)
    ) || false

  // Vérifier si l'utilisateur a des droits de suppression spécifiques à cette édition
  const hasEditionDeleteRights =
    edition.organizerPermissions?.some(
      (perm) => perm.organizer.userId === user.id && perm.canDelete === true
    ) || false

  return (
    isCreator ||
    isConventionAuthor ||
    hasConventionDeleteRights ||
    hasEditionDeleteRights ||
    isGlobalAdmin
  )
}

/**
 * Vérifie si un utilisateur peut gérer le statut d'une édition
 */
export function canManageEditionStatus(
  edition: EditionWithPermissions,
  user: UserForPermissions
): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits d'édition
  const hasManageRights =
    edition.convention.organizers?.some(
      (collab) =>
        collab.userId === user.id && (collab.canEditAllEditions || collab.canEditConvention)
    ) || false

  return isCreator || isConventionAuthor || hasManageRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut voir une édition (lecture seule)
 */
export function canViewEdition(edition: EditionWithPermissions, user: UserForPermissions): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Organisateur (avec n'importe quel droit)
  const isOrganizer =
    edition.convention.organizers?.some((collab) => collab.userId === user.id) || false

  return isCreator || isConventionAuthor || isOrganizer || isGlobalAdmin
}

/**
 * Récupère une édition et vérifie les permissions d'édition en une seule opération
 */
export async function getEditionForEdit(
  editionId: number,
  user: User
): Promise<EditionWithPermissions> {
  const edition = await getEditionWithPermissions(editionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.EDIT_ALL_EDITIONS, ORGANIZER_RIGHTS.EDIT_CONVENTION],
  })

  if (!edition) {
    throw createError({
      status: 404,
      message: 'Edition not found',
    })
  }

  if (!canEditEdition(edition, user)) {
    throw createError({
      status: 403,
      message: "Vous n'avez pas les droits pour modifier cette édition",
    })
  }

  return edition
}

/**
 * Récupère une édition et vérifie les permissions de suppression en une seule opération
 */
export async function getEditionForDelete(
  editionId: number,
  user: User
): Promise<EditionWithPermissions> {
  const edition = await getEditionWithPermissions(editionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.DELETE_ALL_EDITIONS, ORGANIZER_RIGHTS.DELETE_CONVENTION],
  })

  if (!edition) {
    throw createError({
      status: 404,
      message: 'Edition not found',
    })
  }

  if (!canDeleteEdition(edition, user)) {
    throw createError({
      status: 403,
      message: "Vous n'avez pas les droits pour supprimer cette édition",
    })
  }

  return edition
}

/**
 * Récupère une édition et vérifie les permissions de gestion de statut en une seule opération
 */
export async function getEditionForStatusManagement(
  editionId: number,
  user: User
): Promise<EditionWithPermissions> {
  const edition = await getEditionWithPermissions(editionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.EDIT_ALL_EDITIONS, ORGANIZER_RIGHTS.EDIT_CONVENTION],
  })

  if (!edition) {
    throw createError({
      status: 404,
      message: 'Edition not found',
    })
  }

  if (!canManageEditionStatus(edition, user)) {
    throw createError({
      status: 403,
      message: "Vous n'avez pas la permission de modifier le statut de cette édition",
    })
  }

  return edition
}

/**
 * Vérifie si un utilisateur peut accéder aux données d'une édition (lecture seule)
 * Autorise les créateurs, auteurs, admins et tous les organisateurs de la convention
 */
export async function canAccessEditionData(
  editionId: number,
  userId: number,
  event?: any
): Promise<boolean> {
  // Vérifier le mode admin en premier
  const isAdminMode = await checkAdminMode(userId, event)
  if (isAdminMode) return true

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      creatorId: true,
      conventionId: true,
      convention: {
        select: {
          authorId: true,
          organizers: { where: { userId }, select: { userId: true } },
        },
      },
    },
  })

  if (!edition) return false

  // Créateur de l'édition
  if (edition.creatorId === userId) return true

  // Auteur de la convention
  if (edition.convention.authorId === userId) return true

  // Organisateur de la convention (n'importe quel organisateur)
  if (edition.convention.organizers?.length > 0) return true

  return false
}

/**
 * Vérifie si un utilisateur peut accéder aux données d'une édition
 * en tant que gestionnaire OU en tant que bénévole en créneau de contrôle d'accès actif
 */
export async function canAccessEditionDataOrAccessControl(
  editionId: number,
  userId: number,
  event?: any
): Promise<boolean> {
  // Vérifier d'abord les permissions de gestion classiques
  const hasManagementAccess = await canAccessEditionData(editionId, userId, event)
  if (hasManagementAccess) return true

  // Si pas d'accès en gestion, vérifier si l'utilisateur est en créneau actif de contrôle d'accès
  const { isActiveAccessControlVolunteer } = await import('./access-control-permissions')
  const hasAccessControlAccess = await isActiveAccessControlVolunteer(userId, editionId)

  return hasAccessControlAccess
}

/**
 * Vérifie si un utilisateur peut accéder aux données d'une édition
 * en tant que gestionnaire OU en tant que bénévole/leader de validation des repas
 */
export async function canAccessEditionDataOrMealValidation(
  editionId: number,
  userId: number,
  event?: any
): Promise<boolean> {
  // Vérifier d'abord les permissions de gestion classiques
  const hasManagementAccess = await canAccessEditionData(editionId, userId, event)
  if (hasManagementAccess) return true

  // Si pas d'accès en gestion, vérifier si l'utilisateur peut accéder à la validation des repas
  const { canAccessMealValidation } = await import('./meal-validation-permissions')
  const hasMealValidationAccess = await canAccessMealValidation(userId, editionId)

  return hasMealValidationAccess
}

/**
 * Vérifie si un utilisateur peut gérer les artistes d'une édition
 */
export function canManageArtists(
  edition: EditionWithPermissions,
  user: UserForPermissions
): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits de gestion des artistes au niveau convention
  const hasConventionArtistsRights =
    edition.convention.organizers?.some(
      (collab) => collab.userId === user.id && collab.canManageArtists
    ) || false

  // Vérifier si l'utilisateur a des droits de gestion des artistes spécifiques à cette édition
  const hasEditionArtistsRights =
    edition.organizerPermissions?.some(
      (perm) => perm.organizer.userId === user.id && perm.canManageArtists === true
    ) || false

  return (
    isCreator ||
    isConventionAuthor ||
    hasConventionArtistsRights ||
    hasEditionArtistsRights ||
    isGlobalAdmin
  )
}

/**
 * Vérifie si un utilisateur peut gérer les repas d'une édition
 */
export function canManageMeals(edition: EditionWithPermissions, user: UserForPermissions): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits de gestion des repas au niveau convention
  const hasConventionMealsRights =
    edition.convention.organizers?.some(
      (collab) => collab.userId === user.id && collab.canManageMeals
    ) || false

  // Vérifier si l'utilisateur a des droits de gestion des repas spécifiques à cette édition
  const hasEditionMealsRights =
    edition.organizerPermissions?.some(
      (perm) => perm.organizer.userId === user.id && perm.canManageMeals === true
    ) || false

  return (
    isCreator ||
    isConventionAuthor ||
    hasConventionMealsRights ||
    hasEditionMealsRights ||
    isGlobalAdmin
  )
}

/**
 * Vérifie si un utilisateur peut gérer la billeterie d'une édition
 */
export function canManageTicketing(
  edition: EditionWithPermissions,
  user: UserForPermissions
): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits de gestion de la billeterie au niveau convention
  const hasConventionTicketingRights =
    edition.convention.organizers?.some(
      (collab) => collab.userId === user.id && collab.canManageTicketing
    ) || false

  // Vérifier si l'utilisateur a des droits de gestion de la billeterie spécifiques à cette édition
  const hasEditionTicketingRights =
    edition.organizerPermissions?.some(
      (perm) => perm.organizer.userId === user.id && perm.canManageTicketing === true
    ) || false

  return (
    isCreator ||
    isConventionAuthor ||
    hasConventionTicketingRights ||
    hasEditionTicketingRights ||
    isGlobalAdmin
  )
}

/**
 * Vérifie si un utilisateur peut gérer les organisateurs d'une édition
 */
export function canManageEditionOrganizers(
  edition: EditionWithPermissions,
  user: UserForPermissions
): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits de gestion des organisateurs au niveau convention
  const hasConventionOrganizersRights =
    edition.convention.organizers?.some(
      (collab) => collab.userId === user.id && collab.canManageOrganizers
    ) || false

  // Vérifier si l'utilisateur a des droits de gestion des organisateurs spécifiques à cette édition
  const hasEditionOrganizersRights =
    edition.organizerPermissions?.some(
      (perm) => perm.organizer.userId === user.id && perm.canManageOrganizers === true
    ) || false

  return (
    isCreator ||
    isConventionAuthor ||
    hasConventionOrganizersRights ||
    hasEditionOrganizersRights ||
    isGlobalAdmin
  )
}

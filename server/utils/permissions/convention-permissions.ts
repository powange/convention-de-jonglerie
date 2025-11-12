import { ORGANIZER_RIGHTS } from '@@/server/constants/permissions'
import { canManageOrganizers } from '@@/server/utils/organizer-management'

import { prisma } from '../prisma'

import type { UserForPermissions } from './types'
import type { OrganizerRight } from '@@/server/constants/permissions'
import type { User, Convention, ConventionOrganizer } from '@prisma/client'

/**
 * Type pour une convention avec ses organisateurs
 */
export type ConventionWithOrganizers = Convention & {
  organizers: ConventionOrganizer[]
}

/**
 * Type pour une convention avec éditions (pour suppression/archivage)
 */
export type ConventionWithEditions = Convention & {
  editions: { id: number }[]
  organizers: ConventionOrganizer[]
}

/**
 * Options pour récupérer une convention avec ses permissions
 */
export interface ConventionPermissionOptions {
  userId: number
  requiredRights?: OrganizerRight[]
  includeEditions?: boolean
}

/**
 * @deprecated Importez OrganizerRight depuis @@/server/constants/permissions
 * Ce type est conservé pour rétrocompatibilité mais ne devrait plus être utilisé
 */
export type ConventionRight = OrganizerRight

/**
 * Récupère une convention avec les organisateurs filtrés selon les droits requis
 */
export async function getConventionWithPermissions(
  conventionId: number,
  options: ConventionPermissionOptions
): Promise<ConventionWithOrganizers | ConventionWithEditions | null> {
  const { userId, requiredRights = [], includeEditions = false } = options

  // Si aucun droit spécifique requis, on récupère tous les organisateurs de l'utilisateur
  const organizerFilter =
    requiredRights.length > 0
      ? {
          userId,
          OR: requiredRights.map((right) => ({ [right]: true })),
        }
      : { userId }

  return (await prisma.convention.findUnique({
    where: { id: conventionId },
    include: {
      organizers: {
        where: organizerFilter,
      },
      ...(includeEditions && {
        editions: {
          select: { id: true },
        },
      }),
    },
  })) as any
}

/**
 * Vérifie si un utilisateur peut éditer une convention
 */
export function canEditConvention(
  convention: ConventionWithOrganizers,
  user: UserForPermissions
): boolean {
  const isAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits d'édition
  const hasEditRights =
    convention.organizers?.some(
      (collab) => collab.userId === user.id && collab.canEditConvention
    ) || false

  return isAuthor || hasEditRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut supprimer une convention
 */
export function canDeleteConvention(
  convention: ConventionWithOrganizers,
  user: UserForPermissions
): boolean {
  const isAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits de suppression
  const hasDeleteRights =
    convention.organizers?.some(
      (collab) => collab.userId === user.id && collab.canDeleteConvention
    ) || false

  return isAuthor || hasDeleteRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut archiver/désarchiver une convention
 */
export function canArchiveConvention(
  convention: ConventionWithOrganizers,
  user: UserForPermissions
): boolean {
  // Même permissions que la suppression
  return canDeleteConvention(convention, user)
}

// canManageOrganizers importé depuis organizer-management.ts

/**
 * Vérifie si un utilisateur peut voir une convention (lecture seule)
 */
export function canViewConvention(
  convention: ConventionWithOrganizers,
  user: UserForPermissions
): boolean {
  const isAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Organisateur (avec n'importe quel droit)
  const isOrganizer = convention.organizers?.some((collab) => collab.userId === user.id) || false

  return isAuthor || isOrganizer || isGlobalAdmin
}

/**
 * Récupère une convention et vérifie les permissions d'édition en une seule opération
 */
export async function getConventionForEdit(
  conventionId: number,
  user: User
): Promise<ConventionWithOrganizers> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.EDIT_CONVENTION],
  })) as ConventionWithOrganizers

  if (!convention) {
    throw createError({
      statusCode: 404,
      message: 'Convention introuvable',
    })
  }

  if (!canEditConvention(convention, user)) {
    throw createError({
      statusCode: 403,
      message: "Vous n'avez pas les droits pour modifier cette convention",
    })
  }

  return convention
}

/**
 * Récupère une convention et vérifie les permissions de suppression en une seule opération
 */
export async function getConventionForDelete(
  conventionId: number,
  user: User
): Promise<ConventionWithEditions> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.DELETE_CONVENTION],
    includeEditions: true,
  })) as ConventionWithEditions

  if (!convention) {
    throw createError({
      statusCode: 404,
      message: 'Convention introuvable',
    })
  }

  if (!canDeleteConvention(convention, user)) {
    throw createError({
      statusCode: 403,
      message: 'Droit insuffisant pour supprimer cette convention',
    })
  }

  return convention
}

/**
 * Récupère une convention et vérifie les permissions d'archivage en une seule opération
 */
export async function getConventionForArchive(
  conventionId: number,
  user: User
): Promise<ConventionWithEditions> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.DELETE_CONVENTION],
    includeEditions: true,
  })) as ConventionWithEditions

  if (!convention) {
    throw createError({
      statusCode: 404,
      message: 'Convention introuvable',
    })
  }

  if (!canArchiveConvention(convention, user)) {
    throw createError({
      statusCode: 403,
      message: 'Droit insuffisant',
    })
  }

  return convention
}

/**
 * Récupère une convention et vérifie les permissions de gestion des organisateurs
 */
export async function getConventionForOrganizerManagement(
  conventionId: number,
  user: User
): Promise<ConventionWithOrganizers> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.MANAGE_ORGANIZERS],
  })) as ConventionWithOrganizers

  if (!convention) {
    throw createError({
      statusCode: 404,
      message: 'Convention introuvable',
    })
  }

  const canManage = await canManageOrganizers(conventionId, user.id)
  if (!canManage) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les organisateurs',
    })
  }

  return convention
}

/**
 * Vérifie si une convention peut être supprimée (pas d'éditions) ou doit être archivée
 */
export function shouldArchiveInsteadOfDelete(convention: ConventionWithEditions): boolean {
  return convention.editions.length > 0
}

/**
 * Vérifie si un utilisateur peut créer une édition dans une convention
 */
export function canCreateEdition(convention: ConventionWithOrganizers, user: User): boolean {
  const isConventionAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est organisateur avec droits de création
  const hasCreateRights =
    convention.organizers?.some((collab) => collab.userId === user.id && collab.canAddEdition) ||
    false

  return isConventionAuthor || hasCreateRights || isGlobalAdmin
}

/**
 * Récupère une convention et vérifie les permissions de création d'édition
 */
export async function getConventionForEditionCreation(
  conventionId: number,
  user: User
): Promise<ConventionWithOrganizers> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: [ORGANIZER_RIGHTS.ADD_EDITION],
  })) as ConventionWithOrganizers

  if (!convention) {
    throw createError({
      statusCode: 404,
      message: 'Convention introuvable',
    })
  }

  // Vérifier que la convention n'est pas archivée
  if (convention.isArchived) {
    throw createError({
      statusCode: 409,
      message: "Convention archivée: création d'édition impossible",
    })
  }

  if (!canCreateEdition(convention, user)) {
    throw createError({
      statusCode: 403,
      message: 'Droit insuffisant pour créer une édition',
    })
  }

  return convention
}

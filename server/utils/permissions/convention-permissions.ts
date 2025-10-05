import { canManageCollaborators } from '../collaborator-management'
import { prisma } from '../prisma'

import type { User, Convention, ConventionCollaborator } from '@prisma/client'

/**
 * Type pour une convention avec ses collaborateurs
 */
export type ConventionWithCollaborators = Convention & {
  collaborators: ConventionCollaborator[]
}

/**
 * Type pour une convention avec éditions (pour suppression/archivage)
 */
export type ConventionWithEditions = Convention & {
  editions: { id: number }[]
  collaborators: ConventionCollaborator[]
}

/**
 * Options pour récupérer une convention avec ses permissions
 */
export interface ConventionPermissionOptions {
  userId: number
  requiredRights?: ConventionRight[]
  includeEditions?: boolean
}

/**
 * Droits de collaborateur possibles pour les conventions
 */
export type ConventionRight =
  | 'canEditConvention'
  | 'canDeleteConvention'
  | 'canManageCollaborators'
  | 'canManageVolunteers'
  | 'canAddEdition'
  | 'canEditAllEditions'
  | 'canDeleteAllEditions'

/**
 * Récupère une convention avec les collaborateurs filtrés selon les droits requis
 */
export async function getConventionWithPermissions(
  conventionId: number,
  options: ConventionPermissionOptions
): Promise<ConventionWithCollaborators | ConventionWithEditions | null> {
  const { userId, requiredRights = [], includeEditions = false } = options

  // Si aucun droit spécifique requis, on récupère tous les collaborateurs de l'utilisateur
  const collaboratorFilter =
    requiredRights.length > 0
      ? {
          userId,
          OR: requiredRights.map((right) => ({ [right]: true })),
        }
      : { userId }

  return (await prisma.convention.findUnique({
    where: { id: conventionId },
    include: {
      collaborators: {
        where: collaboratorFilter,
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
export function canEditConvention(convention: ConventionWithCollaborators, user: User): boolean {
  const isAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits d'édition
  const hasEditRights =
    convention.collaborators?.some(
      (collab) => collab.userId === user.id && collab.canEditConvention
    ) || false

  return isAuthor || hasEditRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut supprimer une convention
 */
export function canDeleteConvention(convention: ConventionWithCollaborators, user: User): boolean {
  const isAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits de suppression
  const hasDeleteRights =
    convention.collaborators?.some(
      (collab) => collab.userId === user.id && collab.canDeleteConvention
    ) || false

  return isAuthor || hasDeleteRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut archiver/désarchiver une convention
 */
export function canArchiveConvention(convention: ConventionWithCollaborators, user: User): boolean {
  // Même permissions que la suppression
  return canDeleteConvention(convention, user)
}

// canManageCollaborators importé depuis collaborator-management.ts

/**
 * Vérifie si un utilisateur peut voir une convention (lecture seule)
 */
export function canViewConvention(convention: ConventionWithCollaborators, user: User): boolean {
  const isAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Collaborateur (avec n'importe quel droit)
  const isCollaborator =
    convention.collaborators?.some((collab) => collab.userId === user.id) || false

  return isAuthor || isCollaborator || isGlobalAdmin
}

/**
 * Récupère une convention et vérifie les permissions d'édition en une seule opération
 */
export async function getConventionForEdit(
  conventionId: number,
  user: User
): Promise<ConventionWithCollaborators> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: ['canEditConvention'],
  })) as ConventionWithCollaborators

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
    requiredRights: ['canDeleteConvention'],
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
    requiredRights: ['canDeleteConvention'],
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
 * Récupère une convention et vérifie les permissions de gestion des collaborateurs
 */
export async function getConventionForCollaboratorManagement(
  conventionId: number,
  user: User
): Promise<ConventionWithCollaborators> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: ['canManageCollaborators'],
  })) as ConventionWithCollaborators

  if (!convention) {
    throw createError({
      statusCode: 404,
      message: 'Convention introuvable',
    })
  }

  const canManage = await canManageCollaborators(conventionId, user.id)
  if (!canManage) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les collaborateurs',
    })
  }

  return convention
}

/**
 * Utilitaire pour valider un ID de convention
 */
export function validateConventionId(id: string | undefined): number {
  const conventionId = parseInt(id as string)

  if (isNaN(conventionId)) {
    throw createError({
      statusCode: 400,
      message: 'ID de convention invalide',
    })
  }

  return conventionId
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
export function canCreateEdition(convention: ConventionWithCollaborators, user: User): boolean {
  const isConventionAuthor = convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits de création
  const hasCreateRights =
    convention.collaborators?.some((collab) => collab.userId === user.id && collab.canAddEdition) ||
    false

  return isConventionAuthor || hasCreateRights || isGlobalAdmin
}

/**
 * Récupère une convention et vérifie les permissions de création d'édition
 */
export async function getConventionForEditionCreation(
  conventionId: number,
  user: User
): Promise<ConventionWithCollaborators> {
  const convention = (await getConventionWithPermissions(conventionId, {
    userId: user.id,
    requiredRights: ['canAddEdition'],
  })) as ConventionWithCollaborators

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

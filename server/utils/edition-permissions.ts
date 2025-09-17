import { prisma } from './prisma'

import type { User, Edition, Convention, ConventionCollaborator } from '@prisma/client'

/**
 * Type pour une édition avec ses relations nécessaires aux permissions
 */
export type EditionWithPermissions = Edition & {
  convention: Convention & {
    collaborators: ConventionCollaborator[]
  }
}

/**
 * Options pour récupérer une édition avec ses permissions
 */
export interface EditionPermissionOptions {
  userId: number
  requiredRights?: CollaboratorRight[]
}

/**
 * Droits de collaborateur possibles pour les éditions
 */
export type CollaboratorRight =
  | 'canEditAllEditions'
  | 'canDeleteAllEditions'
  | 'canEditConvention'
  | 'canDeleteConvention'
  | 'canManageCollaborators'
  | 'canAddEdition'

/**
 * Récupère une édition avec les collaborateurs filtrés selon les droits requis
 */
export async function getEditionWithPermissions(
  editionId: number,
  options: EditionPermissionOptions
): Promise<EditionWithPermissions | null> {
  const { userId, requiredRights = [] } = options

  // Si aucun droit spécifique requis, on récupère tous les collaborateurs de l'utilisateur
  const collaboratorFilter =
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
          collaborators: {
            where: collaboratorFilter,
          },
        },
      },
    },
  })
}

/**
 * Vérifie si un utilisateur peut éditer une édition
 */
export function canEditEdition(edition: EditionWithPermissions, user: User): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits d'édition
  const hasEditRights =
    edition.convention.collaborators?.some(
      (collab) =>
        collab.userId === user.id && (collab.canEditAllEditions || collab.canEditConvention)
    ) || false

  return isCreator || isConventionAuthor || hasEditRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut supprimer une édition
 */
export function canDeleteEdition(edition: EditionWithPermissions, user: User): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits de suppression
  const hasDeleteRights =
    edition.convention.collaborators?.some(
      (collab) =>
        collab.userId === user.id &&
        (collab.canDeleteAllEditions || collab.canDeleteConvention || collab.canEditAllEditions)
    ) || false

  return isCreator || isConventionAuthor || hasDeleteRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut gérer le statut d'une édition
 */
export function canManageEditionStatus(edition: EditionWithPermissions, user: User): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits de gestion
  const hasManageRights =
    edition.convention.collaborators?.some(
      (collab) =>
        collab.userId === user.id &&
        (collab.canEditAllEditions || collab.canEditConvention || collab.canManageCollaborators)
    ) || false

  return isCreator || isConventionAuthor || hasManageRights || isGlobalAdmin
}

/**
 * Vérifie si un utilisateur peut voir une édition (lecture seule)
 */
export function canViewEdition(edition: EditionWithPermissions, user: User): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Collaborateur (avec n'importe quel droit)
  const isCollaborator =
    edition.convention.collaborators?.some((collab) => collab.userId === user.id) || false

  return isCreator || isConventionAuthor || isCollaborator || isGlobalAdmin
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
    requiredRights: ['canEditAllEditions', 'canEditConvention'],
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      message: 'Edition not found',
    })
  }

  if (!canEditEdition(edition, user)) {
    throw createError({
      statusCode: 403,
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
    requiredRights: ['canDeleteAllEditions', 'canDeleteConvention', 'canEditAllEditions'],
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      message: 'Edition not found',
    })
  }

  if (!canDeleteEdition(edition, user)) {
    throw createError({
      statusCode: 403,
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
    requiredRights: ['canEditAllEditions', 'canEditConvention', 'canManageCollaborators'],
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      message: 'Edition not found',
    })
  }

  if (!canManageEditionStatus(edition, user)) {
    throw createError({
      statusCode: 403,
      message: "Vous n'avez pas la permission de modifier le statut de cette édition",
    })
  }

  return edition
}

/**
 * Utilitaire pour valider un ID d'édition
 */
export function validateEditionId(id: string | undefined): number {
  const editionId = parseInt(id as string)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Edition ID',
    })
  }

  return editionId
}

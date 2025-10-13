import { checkAdminMode } from '../collaborator-management'
import { prisma } from '../prisma'

import type {
  User,
  Edition,
  Convention,
  ConventionCollaborator,
  EditionCollaboratorPermission,
} from '@prisma/client'

/**
 * Type pour une édition avec ses relations nécessaires aux permissions
 */
export type EditionWithPermissions = Edition & {
  convention: Convention & {
    collaborators: ConventionCollaborator[]
  }
  collaboratorPermissions?: (EditionCollaboratorPermission & {
    collaborator: {
      userId: number
    }
  })[]
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
      collaboratorPermissions: {
        include: {
          collaborator: {
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
export function canEditEdition(edition: EditionWithPermissions, user: User): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits d'édition au niveau convention
  const hasConventionEditRights =
    edition.convention.collaborators?.some(
      (collab) =>
        collab.userId === user.id && (collab.canEditAllEditions || collab.canEditConvention)
    ) || false

  // Vérifier si l'utilisateur a des droits d'édition spécifiques à cette édition
  const hasEditionEditRights =
    edition.collaboratorPermissions?.some(
      (perm) => perm.collaborator.userId === user.id && perm.canEdit === true
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
export function canDeleteEdition(edition: EditionWithPermissions, user: User): boolean {
  const isCreator = edition.creatorId === user.id
  const isConventionAuthor = edition.convention.authorId === user.id
  const isGlobalAdmin = user.isGlobalAdmin || false

  // Vérifier si l'utilisateur est collaborateur avec droits de suppression au niveau convention
  const hasConventionDeleteRights =
    edition.convention.collaborators?.some(
      (collab) =>
        collab.userId === user.id &&
        (collab.canDeleteAllEditions || collab.canDeleteConvention || collab.canEditAllEditions)
    ) || false

  // Vérifier si l'utilisateur a des droits de suppression spécifiques à cette édition
  const hasEditionDeleteRights =
    edition.collaboratorPermissions?.some(
      (perm) => perm.collaborator.userId === user.id && perm.canDelete === true
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
 * Vérifie si un utilisateur peut accéder aux données d'une édition (lecture seule)
 * Autorise les créateurs, auteurs, admins et tous les collaborateurs de la convention
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
          collaborators: { where: { userId }, select: { userId: true } },
        },
      },
    },
  })

  if (!edition) return false

  // Créateur de l'édition
  if (edition.creatorId === userId) return true

  // Auteur de la convention
  if (edition.convention.authorId === userId) return true

  // Collaborateur de la convention (n'importe quel collaborateur)
  if (edition.convention.collaborators?.length > 0) return true

  return false
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

// Retrait de l'ancien enum de rôles; tout est géré par droits booléens
// Removed unused types import (frontend types not needed server-side)
import { prisma } from './prisma'

export interface CollaboratorPermissionCheck {
  hasPermission: boolean
  isOwner: boolean
  isCollaborator: boolean
}

/**
 * Vérifie les permissions d'un utilisateur sur une convention
 */
export async function checkUserConventionPermission(
  conventionId: number,
  userId: number
): Promise<CollaboratorPermissionCheck> {
  // Vérifier si l'utilisateur est le créateur
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: { authorId: true },
  })

  if (!convention) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Convention introuvable',
    })
  }

  const isOwner = convention.authorId === userId

  // Vérifier si l'utilisateur est un collaborateur
  const collaborator = await prisma.conventionCollaborator.findUnique({
    where: {
      conventionId_userId: {
        conventionId,
        userId,
      },
    },
  })

  return {
    hasPermission: isOwner || !!collaborator,
    isOwner,
    isCollaborator: !!collaborator,
  }
}

/**
 * Vérifie si un utilisateur peut gérer les collaborateurs d'une convention
 */
export async function canManageCollaborators(
  conventionId: number,
  userId: number
): Promise<boolean> {
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: {
      authorId: true,
      collaborators: { where: { userId }, select: { canManageCollaborators: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true
  const collab = convention.collaborators[0]
  return !!(collab && collab.canManageCollaborators)
}

/**
 * Vérifie si un utilisateur peut éditer une convention
 */
export async function canEditConvention(conventionId: number, userId: number): Promise<boolean> {
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: {
      authorId: true,
      collaborators: { where: { userId }, select: { canEditConvention: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true
  const collab = convention.collaborators[0]
  return !!(collab && collab.canEditConvention)
}

/**
 * Vérifie si un utilisateur peut éditer une édition
 */
export async function canEditEdition(editionId: number, userId: number): Promise<boolean> {
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { creatorId: true, conventionId: true, id: true },
  })
  if (!edition) throw createError({ statusCode: 404, statusMessage: 'Édition introuvable' })
  if (edition.creatorId === userId) return true
  const convention = await prisma.convention.findUnique({
    where: { id: edition.conventionId },
    select: {
      authorId: true,
      collaborators: { where: { userId }, select: { canEditAllEditions: true, id: true } },
      editions: { where: { id: editionId }, select: { id: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true
  const collab = convention.collaborators[0]
  if (!collab) return false
  if (collab.canEditAllEditions) return true
  // Vérifier per-edition permission
  const per = await prisma.editionCollaboratorPermission.findUnique({
    where: { collaboratorId_editionId: { collaboratorId: collab.id, editionId } },
    select: { canEdit: true },
  })
  return !!per?.canEdit
}

/**
 * Ajoute un collaborateur à une convention
 */
interface AddConventionCollaboratorInput {
  conventionId: number
  userId: number
  addedById: number
  rights?: Partial<{
    editConvention: boolean
    deleteConvention: boolean
    manageCollaborators: boolean
    addEdition: boolean
    editAllEditions: boolean
    deleteAllEditions: boolean
  }>
  title?: string
}

export async function addConventionCollaborator(input: AddConventionCollaboratorInput) {
  const { conventionId, userId: userToAddId, addedById, rights, title } = input
  // Vérifier les permissions
  const canManage = await canManageCollaborators(conventionId, addedById)

  if (!canManage) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Seuls les administrateurs peuvent ajouter des collaborateurs',
    })
  }

  // Vérifier que l'utilisateur existe
  const userToAdd = await prisma.user.findUnique({
    where: { id: userToAddId },
    select: { id: true, pseudo: true },
  })

  if (!userToAdd) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Utilisateur introuvable',
    })
  }

  // Créer le collaborateur
  return await prisma.conventionCollaborator.create({
    data: {
      conventionId,
      userId: userToAddId,
      addedById,
      title: title || null,
      canEditConvention: rights?.editConvention ?? false,
      canDeleteConvention: rights?.deleteConvention ?? false,
      canManageCollaborators: rights?.manageCollaborators ?? false,
      canAddEdition: rights?.addEdition ?? false,
      canEditAllEditions: rights?.editAllEditions ?? false,
      canDeleteAllEditions: rights?.deleteAllEditions ?? false,
    },
    include: {
      user: {
        select: { id: true, pseudo: true },
      },
    },
  })
}

/**
 * Recherche un utilisateur par pseudo ou email
 */
export async function findUserByPseudoOrEmail(searchTerm: string) {
  return await prisma.user.findFirst({
    where: {
      OR: [{ pseudo: searchTerm }, { email: searchTerm }],
    },
    select: {
      id: true,
      pseudo: true,
    },
  })
}

/**
 * Supprime un collaborateur d'une convention
 */
export async function deleteConventionCollaborator(
  conventionId: number,
  collaboratorId: number,
  userId: number
): Promise<{ success: boolean; message: string }> {
  // Vérifier les permissions
  const canManage = await canManageCollaborators(conventionId, userId)

  if (!canManage) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Seuls les administrateurs peuvent retirer des collaborateurs',
    })
  }

  // Vérifier que le collaborateur existe
  const collaborator = await prisma.conventionCollaborator.findUnique({
    where: { id: collaboratorId },
    include: {
      user: {
        select: { pseudo: true },
      },
    },
  })

  if (!collaborator || collaborator.conventionId !== conventionId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Collaborateur introuvable',
    })
  }

  // Empêcher l'utilisateur de se supprimer lui-même
  if (collaborator.userId === userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vous ne pouvez pas vous retirer vous-même des collaborateurs',
    })
  }

  // Supprimer le collaborateur
  await prisma.conventionCollaborator.delete({
    where: { id: collaboratorId },
  })

  return {
    success: true,
    message: `${collaborator.user.pseudo} a été retiré des collaborateurs`,
  }
}

/**
 * Récupère tous les collaborateurs d'une convention
 */
export async function getConventionCollaborators(conventionId: number) {
  return await prisma.conventionCollaborator.findMany({
    where: { conventionId },
    include: {
      user: {
        select: {
          id: true,
          pseudo: true,
        },
      },
      addedBy: {
        select: {
          pseudo: true,
        },
      },
    },
    orderBy: {
      addedAt: 'desc',
    },
  })
}

/**
 * Met à jour le rôle d'un collaborateur
 */
export async function updateCollaboratorRights(params: {
  conventionId: number
  collaboratorId: number
  userId: number
  rights?: Partial<{
    editConvention: boolean
    deleteConvention: boolean
    manageCollaborators: boolean
    addEdition: boolean
    editAllEditions: boolean
    deleteAllEditions: boolean
  }>
  title?: string
}) {
  const { conventionId, collaboratorId, userId, rights, title } = params
  const canManage = await canManageCollaborators(conventionId, userId)
  if (!canManage) throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })
  const collaborator = await prisma.conventionCollaborator.findUnique({
    where: { id: collaboratorId },
  })
  if (!collaborator || collaborator.conventionId !== conventionId)
    throw createError({ statusCode: 404, statusMessage: 'Collaborateur introuvable' })
  return prisma.conventionCollaborator.update({
    where: { id: collaboratorId },
    data: {
      title: title ?? collaborator.title,
      canEditConvention: rights?.editConvention ?? collaborator.canEditConvention,
      canDeleteConvention: rights?.deleteConvention ?? collaborator.canDeleteConvention,
      canManageCollaborators: rights?.manageCollaborators ?? collaborator.canManageCollaborators,
      canAddEdition: rights?.addEdition ?? collaborator.canAddEdition,
      canEditAllEditions: rights?.editAllEditions ?? collaborator.canEditAllEditions,
      canDeleteAllEditions: rights?.deleteAllEditions ?? collaborator.canDeleteAllEditions,
    },
    include: { user: { select: { id: true, pseudo: true } } },
  })
}

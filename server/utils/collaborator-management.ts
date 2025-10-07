// Retrait de l'ancien enum de rôles; tout est géré par droits booléens
// Removed unused types import (frontend types not needed server-side)
import { prisma } from './prisma'

/**
 * Vérifie si un utilisateur a les droits d'admin ET que le mode admin est activé
 */
export async function checkAdminMode(userId: number, event?: any): Promise<boolean> {
  // Vérifier d'abord si l'utilisateur est globalAdmin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })

  if (!user?.isGlobalAdmin) {
    return false
  }

  // Vérifier que le mode admin est activé côté client
  if (event) {
    const adminModeHeader = event.node?.req?.headers?.['x-admin-mode']
    return adminModeHeader === 'true'
  }

  return false
}

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
      message: 'Convention introuvable',
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
  userId: number,
  event?: any
): Promise<boolean> {
  // Vérifier le mode admin en premier
  const isAdminMode = await checkAdminMode(userId, event)
  if (isAdminMode) return true

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
 * Vérifie si un utilisateur peut gérer les bénévoles d'une convention
 */
export async function canManageVolunteers(
  conventionId: number,
  userId: number,
  event?: any
): Promise<boolean> {
  // Vérifier le mode admin en premier
  const isAdminMode = await checkAdminMode(userId, event)
  if (isAdminMode) return true

  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: {
      authorId: true,
      collaborators: { where: { userId }, select: { canManageVolunteers: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true
  const collab = convention.collaborators[0]
  return !!(collab && collab.canManageVolunteers)
}

/**
 * Vérifie si un utilisateur peut gérer les bénévoles d'une édition spécifique
 */
export async function canManageEditionVolunteers(
  editionId: number,
  userId: number,
  event?: any
): Promise<boolean> {
  // Vérifier le mode admin en premier
  const isAdminMode = await checkAdminMode(userId, event)
  if (isAdminMode) return true

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { creatorId: true, conventionId: true, id: true },
  })
  if (!edition) return false
  if (edition.creatorId === userId) return true

  const convention = await prisma.convention.findUnique({
    where: { id: edition.conventionId },
    select: {
      authorId: true,
      collaborators: { where: { userId }, select: { canManageVolunteers: true, id: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true

  const collab = convention.collaborators?.[0]
  if (!collab) return false

  // Si le collaborateur a le droit global de gérer les bénévoles
  if (collab.canManageVolunteers) return true

  // Vérifier les permissions spécifiques à cette édition
  const perEdition = await prisma.editionCollaboratorPermission.findUnique({
    where: { collaboratorId_editionId: { collaboratorId: collab.id, editionId } },
    select: { canManageVolunteers: true },
  })
  return !!perEdition?.canManageVolunteers
}

// canEditConvention déplacé vers convention-permissions.ts

// canEditEdition déplacé vers edition-permissions.ts

/**
 * Ajoute un collaborateur à une convention
 */
interface AddConventionCollaboratorInput {
  conventionId: number
  userId: number
  addedById: number
  event?: any
  rights?: Partial<{
    editConvention: boolean
    deleteConvention: boolean
    manageCollaborators: boolean
    addEdition: boolean
    editAllEditions: boolean
    deleteAllEditions: boolean
    manageVolunteers: boolean
  }>
  title?: string
  perEdition?: Array<{
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
  }>
}

export async function addConventionCollaborator(input: AddConventionCollaboratorInput) {
  const { conventionId, userId: userToAddId, addedById, event, rights, title, perEdition } = input
  // Vérifier les permissions
  const canManage = await canManageCollaborators(conventionId, addedById, event)

  if (!canManage) {
    throw createError({
      statusCode: 403,
      message: 'Seuls les administrateurs peuvent ajouter des collaborateurs',
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
      message: 'Utilisateur introuvable',
    })
  }

  // Créer le collaborateur
  return await prisma.$transaction(async (tx) => {
    const collaborator = await tx.conventionCollaborator.create({
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
        canManageVolunteers: rights?.manageVolunteers ?? false,
      },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })

    if (perEdition && perEdition.length) {
      const filtered = perEdition.filter(
        (p) => p && (p.canEdit || p.canDelete || p.canManageVolunteers)
      )
      if (filtered.length) {
        await tx.editionCollaboratorPermission.createMany({
          data: filtered.map((p) => ({
            collaboratorId: collaborator.id,
            editionId: p.editionId,
            canEdit: !!p.canEdit,
            canDelete: !!p.canDelete,
            canManageVolunteers: !!p.canManageVolunteers,
          })),
          skipDuplicates: true,
        })
      }
    }

    const withPerEdition = await tx.conventionCollaborator.findUnique({
      where: { id: collaborator.id },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })

    // Historique CREATED
    if (withPerEdition) {
      await tx.collaboratorPermissionHistory.create({
        data: {
          conventionId,
          targetUserId: withPerEdition.userId,
          actorId: addedById,
          changeType: 'CREATED',
          after: {
            title: withPerEdition.title,
            rights: {
              canEditConvention: withPerEdition.canEditConvention,
              canDeleteConvention: withPerEdition.canDeleteConvention,
              canManageCollaborators: withPerEdition.canManageCollaborators,
              canAddEdition: withPerEdition.canAddEdition,
              canEditAllEditions: withPerEdition.canEditAllEditions,
              canDeleteAllEditions: withPerEdition.canDeleteAllEditions,
              canManageVolunteers: withPerEdition.canManageVolunteers,
            },
            perEdition: (withPerEdition.perEditionPermissions || []).map((p) => ({
              editionId: p.editionId,
              canEdit: p.canEdit,
              canDelete: p.canDelete,
              canManageVolunteers: p.canManageVolunteers,
            })),
          } as any,
        } as any,
      })
    }
    return withPerEdition
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
      message: 'Seuls les administrateurs peuvent retirer des collaborateurs',
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
      message: 'Collaborateur introuvable',
    })
  }

  // Empêcher l'utilisateur de se supprimer lui-même
  if (collaborator.userId === userId) {
    throw createError({
      statusCode: 400,
      message: 'Vous ne pouvez pas vous retirer vous-même des collaborateurs',
    })
  }

  // Snapshot avant suppression
  const before = {
    // On n'enregistre plus les infos user redondantes (pseudo / id) car targetUserId suffit
    title: collaborator.title,
    rights: {
      canEditConvention: collaborator.canEditConvention,
      canDeleteConvention: collaborator.canDeleteConvention,
      canManageCollaborators: collaborator.canManageCollaborators,
      canAddEdition: collaborator.canAddEdition,
      canEditAllEditions: collaborator.canEditAllEditions,
      canDeleteAllEditions: collaborator.canDeleteAllEditions,
      canManageVolunteers: collaborator.canManageVolunteers,
    },
  }

  await prisma.$transaction(async (tx) => {
    // Historiser AVANT suppression en mettant collaboratorId à null pour conserver la ligne après delete
    await tx.collaboratorPermissionHistory.create({
      data: {
        conventionId,
        targetUserId: collaborator.userId,
        actorId: userId,
        changeType: 'REMOVED',
        before: before as any,
        after: {
          removed: true,
          removedAt: new Date().toISOString(),
          removedCollaboratorId: collaborator.id,
          removedUserId: collaborator.userId,
        } as any,
      } as any,
    })
    await tx.conventionCollaborator.delete({ where: { id: collaboratorId } })
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
    manageVolunteers: boolean
  }>
  title?: string
  perEdition?: Array<{
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
  }>
}) {
  const { conventionId, collaboratorId, userId, rights, title, perEdition } = params
  const canManage = await canManageCollaborators(conventionId, userId)
  if (!canManage) throw createError({ statusCode: 403, message: 'Droits insuffisants' })
  const collaborator = await prisma.conventionCollaborator.findUnique({
    where: { id: collaboratorId },
  })
  if (!collaborator || collaborator.conventionId !== conventionId)
    throw createError({ statusCode: 404, message: 'Collaborateur introuvable' })
  return prisma.$transaction(async (tx) => {
    await tx.conventionCollaborator.update({
      where: { id: collaboratorId },
      data: {
        title: title ?? collaborator.title,
        canEditConvention: rights?.editConvention ?? collaborator.canEditConvention,
        canDeleteConvention: rights?.deleteConvention ?? collaborator.canDeleteConvention,
        canManageCollaborators: rights?.manageCollaborators ?? collaborator.canManageCollaborators,
        canAddEdition: rights?.addEdition ?? collaborator.canAddEdition,
        canEditAllEditions: rights?.editAllEditions ?? collaborator.canEditAllEditions,
        canDeleteAllEditions: rights?.deleteAllEditions ?? collaborator.canDeleteAllEditions,
        canManageVolunteers: rights?.manageVolunteers ?? collaborator.canManageVolunteers,
      },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })

    // Gérer les permissions per-edition si fournies
    if (perEdition) {
      // Supprimer toutes les permissions existantes pour ce collaborateur
      await tx.editionCollaboratorPermission.deleteMany({
        where: { collaboratorId },
      })

      // Ajouter les nouvelles permissions (filtrer les vides)
      const filtered = perEdition.filter(
        (p) => p && (p.canEdit || p.canDelete || p.canManageVolunteers)
      )
      if (filtered.length > 0) {
        await tx.editionCollaboratorPermission.createMany({
          data: filtered.map((p) => ({
            collaboratorId,
            editionId: p.editionId,
            canEdit: !!p.canEdit,
            canDelete: !!p.canDelete,
            canManageVolunteers: !!p.canManageVolunteers,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Récupérer le collaborateur avec les permissions mises à jour
    return tx.conventionCollaborator.findUnique({
      where: { id: collaboratorId },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })
  })
}

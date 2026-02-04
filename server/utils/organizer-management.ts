// Retrait de l'ancien enum de rôles; tout est géré par droits booléens
// Removed unused types import (frontend types not needed server-side)

import type {
  OrganizerPermissionSnapshot,
  OrganizerRemovalSnapshot,
  PrismaTransaction,
} from '../types/prisma-helpers'
import type { H3Event } from 'h3'

/**
 * Vérifie si un utilisateur a les droits d'admin ET que le mode admin est activé
 */
export async function checkAdminMode(userId: number, event?: H3Event): Promise<boolean> {
  // Vérifier d'abord si l'utilisateur est globalAdmin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGlobalAdmin: true },
  })

  if (!user?.isGlobalAdmin) {
    return false
  }

  // Vérifier que le mode admin est activé côté client (header ou query param)
  if (event) {
    const adminModeHeader = event.node?.req?.headers?.['x-admin-mode']
    const query = getQuery(event)
    const adminModeQuery = query.adminMode

    return adminModeHeader === 'true' || adminModeQuery === 'true'
  }

  return false
}

export interface OrganizerPermissionCheck {
  hasPermission: boolean
  isOwner: boolean
  isOrganizer: boolean
}

/**
 * Vérifie les permissions d'un utilisateur sur une convention
 */
export async function checkUserConventionPermission(
  conventionId: number,
  userId: number
): Promise<OrganizerPermissionCheck> {
  // Vérifier si l'utilisateur est le créateur
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: { authorId: true },
  })

  if (!convention) {
    throw createError({
      status: 404,
      message: 'Convention introuvable',
    })
  }

  const isOwner = convention.authorId === userId

  // Vérifier si l'utilisateur est un organisateur
  const organizer = await prisma.conventionOrganizer.findUnique({
    where: {
      conventionId_userId: {
        conventionId,
        userId,
      },
    },
  })

  return {
    hasPermission: isOwner || !!organizer,
    isOwner,
    isOrganizer: !!organizer,
  }
}

/**
 * Vérifie si un utilisateur peut accéder à une convention (lecture seule)
 * Prend en compte le mode admin
 */
export async function canAccessConvention(
  conventionId: number,
  userId: number,
  event?: H3Event
): Promise<boolean> {
  // Vérifier le mode admin en premier
  const isAdminMode = await checkAdminMode(userId, event)
  if (isAdminMode) return true

  // Sinon, vérifier les permissions normales
  const permission = await checkUserConventionPermission(conventionId, userId)
  return permission.hasPermission
}

/**
 * Vérifie si un utilisateur peut gérer les organisateurs d'une convention
 */
export async function canManageOrganizers(
  conventionId: number,
  userId: number,
  event?: H3Event
): Promise<boolean> {
  // Vérifier le mode admin en premier
  const isAdminMode = await checkAdminMode(userId, event)
  if (isAdminMode) return true

  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: {
      authorId: true,
      organizers: { where: { userId }, select: { canManageOrganizers: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true
  const collab = convention.organizers[0]
  return !!(collab && collab.canManageOrganizers)
}

/**
 * Vérifie si un utilisateur peut gérer les bénévoles d'une convention
 */
export async function canManageVolunteers(
  conventionId: number,
  userId: number,
  event?: H3Event
): Promise<boolean> {
  // Vérifier le mode admin en premier
  const isAdminMode = await checkAdminMode(userId, event)
  if (isAdminMode) return true

  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    select: {
      authorId: true,
      organizers: { where: { userId }, select: { canManageVolunteers: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true
  const collab = convention.organizers[0]
  return !!(collab && collab.canManageVolunteers)
}

/**
 * Vérifie si un utilisateur peut gérer les bénévoles d'une édition spécifique
 */
export async function canManageEditionVolunteers(
  editionId: number,
  userId: number,
  event?: H3Event
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
      organizers: { where: { userId }, select: { canManageVolunteers: true, id: true } },
    },
  })
  if (!convention) return false
  if (convention.authorId === userId) return true

  const collab = convention.organizers?.[0]
  if (!collab) return false

  // Si le organisateur a le droit global de gérer les bénévoles
  if (collab.canManageVolunteers) return true

  // Vérifier les permissions spécifiques à cette édition
  const perEdition = await prisma.editionOrganizerPermission.findUnique({
    where: { organizerId_editionId: { organizerId: collab.id, editionId } },
    select: { canManageVolunteers: true },
  })
  return !!perEdition?.canManageVolunteers
}

// canEditConvention déplacé vers convention-permissions.ts

// canEditEdition déplacé vers edition-permissions.ts

/**
 * Ajoute un organisateur à une convention
 */
interface AddConventionOrganizerInput {
  conventionId: number
  userId: number
  addedById: number
  event?: H3Event
  rights?: Partial<{
    editConvention: boolean
    deleteConvention: boolean
    manageOrganizers: boolean
    addEdition: boolean
    editAllEditions: boolean
    deleteAllEditions: boolean
    manageVolunteers: boolean
    manageArtists: boolean
  }>
  title?: string
  perEdition?: Array<{
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
    canManageArtists?: boolean
  }>
}

export async function addConventionOrganizer(input: AddConventionOrganizerInput) {
  const { conventionId, userId: userToAddId, addedById, event, rights, title, perEdition } = input
  // Vérifier les permissions
  const canManage = await canManageOrganizers(conventionId, addedById, event)

  if (!canManage) {
    throw createError({
      status: 403,
      message: 'Seuls les administrateurs peuvent ajouter des organisateurs',
    })
  }

  // Vérifier que l'utilisateur existe
  const userToAdd = await prisma.user.findUnique({
    where: { id: userToAddId },
    select: { id: true, pseudo: true },
  })

  if (!userToAdd) {
    throw createError({
      status: 404,
      message: 'Utilisateur introuvable',
    })
  }

  // Créer le organisateur
  return await prisma.$transaction(async (tx: PrismaTransaction) => {
    const organizer = await tx.conventionOrganizer.create({
      data: {
        conventionId,
        userId: userToAddId,
        addedById,
        title: title || null,
        canEditConvention: rights?.editConvention ?? false,
        canDeleteConvention: rights?.deleteConvention ?? false,
        canManageOrganizers: rights?.manageOrganizers ?? false,
        canAddEdition: rights?.addEdition ?? false,
        canEditAllEditions: rights?.editAllEditions ?? false,
        canDeleteAllEditions: rights?.deleteAllEditions ?? false,
        canManageVolunteers: rights?.manageVolunteers ?? false,
        canManageArtists: rights?.manageArtists ?? false,
      },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })

    if (perEdition && perEdition.length) {
      const filtered = perEdition.filter(
        (p) => p && (p.canEdit || p.canDelete || p.canManageVolunteers || p.canManageArtists)
      )
      if (filtered.length) {
        await tx.editionOrganizerPermission.createMany({
          data: filtered.map((p) => ({
            organizerId: organizer.id,
            editionId: p.editionId,
            canEdit: !!p.canEdit,
            canDelete: !!p.canDelete,
            canManageVolunteers: !!p.canManageVolunteers,
            canManageArtists: !!p.canManageArtists,
          })),
          skipDuplicates: true,
        })
      }
    }

    const withPerEdition = await tx.conventionOrganizer.findUnique({
      where: { id: organizer.id },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })

    // Historique CREATED
    if (withPerEdition) {
      const snapshot: OrganizerPermissionSnapshot = {
        title: withPerEdition.title,
        rights: {
          canEditConvention: withPerEdition.canEditConvention,
          canDeleteConvention: withPerEdition.canDeleteConvention,
          canManageOrganizers: withPerEdition.canManageOrganizers,
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
      }
      await tx.organizerPermissionHistory.create({
        data: {
          conventionId,
          targetUserId: withPerEdition.userId,
          actorId: addedById,
          changeType: 'CREATED',
          after: snapshot,
        },
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
 * Supprime un organisateur d'une convention
 */
export async function deleteConventionOrganizer(
  conventionId: number,
  organizerId: number,
  userId: number,
  event?: H3Event
): Promise<{ success: boolean; message: string }> {
  // Vérifier les permissions
  const canManage = await canManageOrganizers(conventionId, userId, event)

  if (!canManage) {
    throw createError({
      status: 403,
      message: 'Seuls les administrateurs peuvent retirer des organisateurs',
    })
  }

  // Vérifier que le organisateur existe
  const organizer = await prisma.conventionOrganizer.findUnique({
    where: { id: organizerId },
    include: {
      user: {
        select: { pseudo: true },
      },
    },
  })

  if (!organizer || organizer.conventionId !== conventionId) {
    throw createError({
      status: 404,
      message: 'Organisateur introuvable',
    })
  }

  // Empêcher l'utilisateur de se supprimer lui-même, sauf s'il est en mode super admin
  const isAdminMode = await checkAdminMode(userId, event)
  if (organizer.userId === userId && !isAdminMode) {
    throw createError({
      status: 400,
      message: 'Vous ne pouvez pas vous retirer vous-même des organisateurs',
    })
  }

  // Snapshot avant suppression
  const before: OrganizerPermissionSnapshot = {
    // On n'enregistre plus les infos user redondantes (pseudo / id) car targetUserId suffit
    title: organizer.title,
    rights: {
      canEditConvention: organizer.canEditConvention,
      canDeleteConvention: organizer.canDeleteConvention,
      canManageOrganizers: organizer.canManageOrganizers,
      canAddEdition: organizer.canAddEdition,
      canEditAllEditions: organizer.canEditAllEditions,
      canDeleteAllEditions: organizer.canDeleteAllEditions,
      canManageVolunteers: organizer.canManageVolunteers,
    },
  }

  const after: OrganizerRemovalSnapshot = {
    removed: true,
    removedAt: new Date().toISOString(),
    removedOrganizerId: organizer.id,
    removedUserId: organizer.userId,
  }

  await prisma.$transaction(async (tx: PrismaTransaction) => {
    // Historiser AVANT suppression en mettant organizerId à null pour conserver la ligne après delete
    await tx.organizerPermissionHistory.create({
      data: {
        conventionId,
        targetUserId: organizer.userId,
        actorId: userId,
        changeType: 'REMOVED',
        before,
        after,
      },
    })
    await tx.conventionOrganizer.delete({ where: { id: organizerId } })
  })

  return {
    success: true,
    message: `${organizer.user.pseudo} a été retiré des organisateurs`,
  }
}

/**
 * Récupère tous les organisateurs d'une convention
 */
export async function getConventionOrganizers(conventionId: number) {
  return await prisma.conventionOrganizer.findMany({
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
 * Met à jour le rôle d'un organisateur
 */
export async function updateOrganizerRights(params: {
  conventionId: number
  organizerId: number
  userId: number
  rights?: Partial<{
    editConvention: boolean
    deleteConvention: boolean
    manageOrganizers: boolean
    addEdition: boolean
    editAllEditions: boolean
    deleteAllEditions: boolean
    manageVolunteers: boolean
    manageArtists: boolean
  }>
  title?: string
  perEdition?: Array<{
    editionId: number
    canEdit?: boolean
    canDelete?: boolean
    canManageVolunteers?: boolean
    canManageArtists?: boolean
  }>
}) {
  const { conventionId, organizerId, userId, rights, title, perEdition } = params
  const canManage = await canManageOrganizers(conventionId, userId)
  if (!canManage) throw createError({ status: 403, message: 'Droits insuffisants' })
  const organizer = await prisma.conventionOrganizer.findUnique({
    where: { id: organizerId },
  })
  if (!organizer || organizer.conventionId !== conventionId)
    throw createError({ status: 404, message: 'Organisateur introuvable' })
  return prisma.$transaction(async (tx: PrismaTransaction) => {
    await tx.conventionOrganizer.update({
      where: { id: organizerId },
      data: {
        title: title ?? organizer.title,
        canEditConvention: rights?.editConvention ?? organizer.canEditConvention,
        canDeleteConvention: rights?.deleteConvention ?? organizer.canDeleteConvention,
        canManageOrganizers: rights?.manageOrganizers ?? organizer.canManageOrganizers,
        canAddEdition: rights?.addEdition ?? organizer.canAddEdition,
        canEditAllEditions: rights?.editAllEditions ?? organizer.canEditAllEditions,
        canDeleteAllEditions: rights?.deleteAllEditions ?? organizer.canDeleteAllEditions,
        canManageVolunteers: rights?.manageVolunteers ?? organizer.canManageVolunteers,
        canManageArtists: rights?.manageArtists ?? organizer.canManageArtists,
      },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })

    // Gérer les permissions per-edition si fournies
    if (perEdition) {
      // Supprimer toutes les permissions existantes pour ce organisateur
      await tx.editionOrganizerPermission.deleteMany({
        where: { organizerId },
      })

      // Ajouter les nouvelles permissions (filtrer les vides)
      const filtered = perEdition.filter(
        (p) => p && (p.canEdit || p.canDelete || p.canManageVolunteers || p.canManageArtists)
      )
      if (filtered.length > 0) {
        await tx.editionOrganizerPermission.createMany({
          data: filtered.map((p) => ({
            organizerId,
            editionId: p.editionId,
            canEdit: !!p.canEdit,
            canDelete: !!p.canDelete,
            canManageVolunteers: !!p.canManageVolunteers,
            canManageArtists: !!p.canManageArtists,
          })),
          skipDuplicates: true,
        })
      }
    }

    // Récupérer le organisateur avec les permissions mises à jour
    return tx.conventionOrganizer.findUnique({
      where: { id: organizerId },
      include: { user: { select: { id: true, pseudo: true } }, perEditionPermissions: true },
    })
  })
}

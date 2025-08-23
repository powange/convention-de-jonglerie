import { checkUserConventionPermission } from '../../../utils/collaborator-management'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const conventionId = parseInt(getRouterParam(event, 'id') as string)

    // Vérifier l'authentification (le middleware s'en charge déjà)
    if (!event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Non authentifié',
      })
    }

    // Vérifier les permissions de l'utilisateur sur la convention
    const permission = await checkUserConventionPermission(conventionId, event.context.user.id)

    if (!permission.hasPermission) {
      throw createError({
        statusCode: 403,
        statusMessage: "Vous n'avez pas accès à cette convention",
      })
    }

    // Récupérer avec nouvelles permissions
    const collaborators = await prisma.conventionCollaborator.findMany({
      where: { conventionId },
      include: {
        user: { select: { id: true, pseudo: true } },
        addedBy: { select: { pseudo: true } },
        perEditionPermissions: true,
      },
      orderBy: { addedAt: 'desc' },
    })

    return collaborators.map((c) => ({
      id: c.id,
      user: c.user,
      addedBy: c.addedBy,
      addedAt: c.addedAt,
      title: c.title,
      rights: {
        editConvention: c.canEditConvention,
        deleteConvention: c.canDeleteConvention,
        manageCollaborators: c.canManageCollaborators,
        addEdition: c.canAddEdition,
        editAllEditions: c.canEditAllEditions,
        deleteAllEditions: c.canDeleteAllEditions,
      },
      perEdition: c.perEditionPermissions.map((p) => ({
        editionId: p.editionId,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
      })),
    }))
  } catch (error: unknown) {
    const httpError = error as { statusCode?: number; message?: string }
    if (httpError.statusCode) {
      throw error
    }
    console.error('Erreur lors de la récupération des collaborateurs:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
    })
  }
})

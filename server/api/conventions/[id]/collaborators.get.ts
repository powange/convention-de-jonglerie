import { requireAuth } from '@@/server/utils/auth-utils'
import { checkUserConventionPermission } from '@@/server/utils/collaborator-management'
import { validateConventionId } from '@@/server/utils/permissions/convention-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const conventionId = validateConventionId(event)
    const user = requireAuth(event)

    // Vérifier les permissions de l'utilisateur sur la convention
    const permission = await checkUserConventionPermission(conventionId, user.id)

    if (!permission.hasPermission) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas accès à cette convention",
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
        manageVolunteers: c.canManageVolunteers,
        addEdition: c.canAddEdition,
        editAllEditions: c.canEditAllEditions,
        deleteAllEditions: c.canDeleteAllEditions,
      },
      perEdition: c.perEditionPermissions.map((p) => ({
        editionId: p.editionId,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canManageVolunteers: p.canManageVolunteers,
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
      message: 'Erreur serveur',
    })
  }
})

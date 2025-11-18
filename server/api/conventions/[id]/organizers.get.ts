import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessConvention } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { organizerWithUserInclude } from '@@/server/utils/prisma-select-helpers'
import { validateConventionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const conventionId = validateConventionId(event)
    const user = requireAuth(event)

    // Vérifier les permissions de l'utilisateur sur la convention (inclut le mode admin)
    const canAccess = await canAccessConvention(conventionId, user.id, event)

    if (!canAccess) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas accès à cette convention",
      })
    }

    // Récupérer avec nouvelles permissions
    const organizers = await prisma.conventionOrganizer.findMany({
      where: { conventionId },
      include: organizerWithUserInclude,
      orderBy: { addedAt: 'desc' },
    })

    return organizers.map((c) => ({
      id: c.id,
      user: c.user,
      addedBy: c.addedBy,
      addedAt: c.addedAt,
      title: c.title,
      rights: {
        editConvention: c.canEditConvention,
        deleteConvention: c.canDeleteConvention,
        manageOrganizers: c.canManageOrganizers,
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
  },
  { operationName: 'GetConventionOrganizers' }
)

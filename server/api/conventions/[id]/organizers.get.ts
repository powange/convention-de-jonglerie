import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessConvention } from '#server/utils/organizer-management'
import { organizerWithUserInclude } from '#server/utils/prisma-select-helpers'
import { validateConventionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const conventionId = validateConventionId(event)
    const user = requireAuth(event)

    // Vérifier les permissions de l'utilisateur sur la convention (inclut le mode admin)
    const canAccess = await canAccessConvention(conventionId, user.id, event)

    if (!canAccess) {
      throw createError({
        status: 403,
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
        manageArtists: c.canManageArtists,
        manageMeals: c.canManageMeals,
        manageTicketing: c.canManageTicketing,
        addEdition: c.canAddEdition,
        editAllEditions: c.canEditAllEditions,
        deleteAllEditions: c.canDeleteAllEditions,
      },
      perEdition: c.perEditionPermissions.map((p) => ({
        editionId: p.editionId,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canManageVolunteers: p.canManageVolunteers,
        canManageArtists: p.canManageArtists,
        canManageMeals: p.canManageMeals,
        canManageTicketing: p.canManageTicketing,
      })),
    }))
  },
  { operationName: 'GetConventionOrganizers' }
)

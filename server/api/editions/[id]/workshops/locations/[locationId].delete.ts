import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canEditEdition } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const locationId = validateResourceId(event, 'locationId', 'atelier')

    // Vérifier que le lieu existe et appartient à l'édition
    const location = await prisma.workshopLocation.findFirst({
      where: {
        id: locationId,
        editionId,
      },
      include: {
        edition: {
          include: {
            convention: {
              include: {
                organizers: true,
              },
            },
            organizerPermissions: {
              include: {
                organizer: true,
              },
            },
          },
        },
      },
    })

    if (!location) {
      throw createError({
        status: 404,
        message: 'Lieu non trouvé',
      })
    }

    // Vérifier les permissions
    const hasPermission = canEditEdition(location.edition, user)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les lieux de cette édition",
      })
    }

    // Supprimer le lieu
    await prisma.workshopLocation.delete({
      where: { id: locationId },
    })

    return createSuccessResponse(null)
  },
  { operationName: 'DeleteWorkshopLocation' }
)

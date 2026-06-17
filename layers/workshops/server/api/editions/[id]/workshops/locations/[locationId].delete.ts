import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageWorkshopLocations } from '#server/utils/permissions/workshop-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const locationId = validateResourceId(event, 'locationId', 'atelier')

    // Vérifier que le lieu existe et appartient à l'édition (modèle propre du layer)
    const location = await prisma.workshopLocation.findFirst({
      where: {
        id: locationId,
        editionId,
      },
      select: { id: true },
    })

    if (!location) {
      throw createError({
        status: 404,
        message: 'Lieu non trouvé',
      })
    }

    // Vérifier les permissions (organisateur uniquement) — util core, lit l'Edition côté core.
    // Le lieu appartient à `editionId` (filtré ci-dessus), donc le contrôle porte sur cette édition.
    const hasPermission = await canManageWorkshopLocations(user, editionId)
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
